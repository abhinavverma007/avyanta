const Client = require('../models/Client');
const Task = require('../models/Task');
const DailyReport = require('../models/DailyReport');
const { recordAudit } = require('../utils/audit');
const { sanitize: sanitizeTask } = require('./adminTask.controller');

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitize(client, taskCount = 0, lastServiced = null) {
  return {
    id: client._id.toString(),
    name: client.name,
    vendorName: client.vendorName,
    taskCount,
    lastServiced,
    createdAt: client.createdAt,
  };
}

// Same client + vendor twice would just be noise in the Assign Task dropdown;
// compared case-insensitively so "satya solar" can't sneak in next to
// "Satya Solar".
async function findDuplicate(name, vendorName, excludeId) {
  const filter = {
    name: new RegExp(`^${escapeRegex(name)}$`, 'i'),
    vendorName: new RegExp(`^${escapeRegex(vendorName)}$`, 'i'),
  };
  if (excludeId) filter._id = { $ne: excludeId };
  return Client.findOne(filter);
}

function readFields(body) {
  const name = String(body.name ?? '').trim();
  const vendorName = String(body.vendorName ?? '').trim();
  if (!name) return { error: 'Client name is required.' };
  if (!vendorName) return { error: 'Vendor name is required.' };
  if (name.length > 120 || vendorName.length > 120) return { error: 'Names can be at most 120 characters.' };
  return { name, vendorName };
}

// Owner-only (see adminClients.routes.js) — the Assign Task dropdown reads
// clients through the tasks router instead, so a delegated Supervisor can
// pick a client without being able to manage them.
exports.list = async (req, res) => {
  const [clients, counts] = await Promise.all([
    Client.find().sort({ name: 1, vendorName: 1 }).lean(),
    Task.aggregate([{ $match: { client: { $ne: null } } }, { $group: { _id: '$client', n: { $sum: 1 }, last: { $max: '$date' } } }]),
  ]);
  const byClient = new Map(counts.map((c) => [String(c._id), c]));
  res.json({ clients: clients.map((c) => sanitize(c, byClient.get(String(c._id))?.n || 0, byClient.get(String(c._id))?.last || null)) });
};

exports.create = async (req, res) => {
  const fields = readFields(req.body);
  if (fields.error) return res.status(400).json({ message: fields.error });
  if (await findDuplicate(fields.name, fields.vendorName)) {
    return res.status(409).json({ message: `${fields.name} with vendor ${fields.vendorName} already exists.` });
  }

  const client = await Client.create({ name: fields.name, vendorName: fields.vendorName });

  await recordAudit(req, {
    action: 'client.create',
    resourceType: 'Client',
    resourceId: client._id,
    summary: `Added client "${client.name}" (vendor: ${client.vendorName})`,
  });

  res.status(201).json({ client: sanitize(client) });
};

exports.update = async (req, res) => {
  const client = await Client.findById(req.params.id);
  if (!client) return res.status(404).json({ message: 'Client not found.' });

  const fields = readFields(req.body);
  if (fields.error) return res.status(400).json({ message: fields.error });
  if (fields.name === client.name && fields.vendorName === client.vendorName) {
    return res.status(409).json({ message: 'Nothing changed.' });
  }
  if (await findDuplicate(fields.name, fields.vendorName, client._id)) {
    return res.status(409).json({ message: `${fields.name} with vendor ${fields.vendorName} already exists.` });
  }

  const before = { name: client.name, vendorName: client.vendorName };
  client.name = fields.name;
  client.vendorName = fields.vendorName;
  await client.save();

  // A task's title *is* its client's name, so a rename (e.g. fixing a typo)
  // carries through to the tasks already assigned to this client.
  let tasksRenamed = 0;
  if (before.name !== client.name) {
    const r = await Task.updateMany({ client: client._id }, { $set: { title: client.name } });
    tasksRenamed = r.modifiedCount ?? 0;
  }

  await recordAudit(req, {
    action: 'client.update',
    resourceType: 'Client',
    resourceId: client._id,
    summary: `Updated client "${before.name}" (vendor: ${before.vendorName}) → "${client.name}" (vendor: ${client.vendorName})`,
    metadata: { before, after: { name: client.name, vendorName: client.vendorName }, tasksRenamed },
  });

  res.json({ client: sanitize(client, await Task.countDocuments({ client: client._id })) });
};

// Tasks already assigned to this client keep their title text (that's their
// history) — they just lose the link to a client record that no longer exists.
exports.remove = async (req, res) => {
  const client = await Client.findByIdAndDelete(req.params.id);
  if (!client) return res.status(404).json({ message: 'Client not found.' });

  const r = await Task.updateMany({ client: client._id }, { $unset: { client: 1 } });

  await recordAudit(req, {
    action: 'client.delete',
    resourceType: 'Client',
    resourceId: client._id,
    summary: `Deleted client "${client.name}" (vendor: ${client.vendorName})`,
    metadata: { tasksUnlinked: r.modifiedCount ?? 0 },
  });

  res.json({ success: true, tasksUnlinked: r.modifiedCount ?? 0 });
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Servicing history: every task assigned against this client, newest first —
// each task is one visit on one date (a multi-day assignment is one task per
// day). The summary always covers the client's whole history; the optional
// status / date filters only narrow the list below it.
exports.history = async (req, res) => {
  const client = await Client.findById(req.params.id).lean().catch(() => null);
  if (!client) return res.status(404).json({ message: 'Client not found.' });

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const filter = { client: client._id };
  if (req.query.status) {
    // Tasks from before `status` existed have none stored — they count as pending.
    if (req.query.status === 'pending') filter.$or = [{ status: 'pending' }, { status: { $exists: false } }];
    else filter.status = req.query.status;
  }
  const { from, to } = req.query;
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
    return res.status(400).json({ message: 'from/to must be in YYYY-MM-DD format.' });
  }
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lte = to;
  }

  const [tasks, total, agg] = await Promise.all([
    Task.find(filter)
      .populate('employees', 'name employeeId')
      .populate('completedBy', 'name employeeId')
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Task.countDocuments(filter),
    Task.aggregate([
      { $match: { client: client._id } },
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          dates: { $addToSet: '$date' },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          firstServiced: { $min: '$date' },
          lastServiced: { $max: '$date' },
        },
      },
    ]),
  ]);

  // The end-of-day work reports workers wrote about each of these visits.
  const taskIds = tasks.map((t) => t._id);
  const reports = taskIds.length
    ? await DailyReport.find({ 'jobs.task': { $in: taskIds } }).populate('employee', 'name').lean()
    : [];
  const reportsByTask = new Map();
  for (const r of reports) {
    for (const j of r.jobs) {
      const key = String(j.task);
      if (!reportsByTask.has(key)) reportsByTask.set(key, []);
      reportsByTask.get(key).push({
        employeeName: r.employee ? r.employee.name : '',
        workTypes: r.workTypes,
        problems: r.problems,
        problemNote: r.problemNote || '',
        safetyIncident: !!r.safetyIncident,
      });
    }
  }

  const a = agg[0];
  res.json({
    client: { id: client._id.toString(), name: client.name, vendorName: client.vendorName },
    summary: {
      totalTasks: a ? a.totalTasks : 0,
      daysServiced: a ? a.dates.length : 0,
      completed: a ? a.completed : 0,
      firstServiced: a ? a.firstServiced : null,
      lastServiced: a ? a.lastServiced : null,
    },
    tasks: tasks.map((t) => ({ ...sanitizeTask(t), reports: reportsByTask.get(String(t._id)) || [] })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
};

// For the Assign Task dropdown — anyone allowed to assign tasks (owner, or a
// Supervisor with the Tasks permission) can read the list, nothing more.
exports.listForTasks = async (req, res) => {
  const clients = await Client.find().sort({ name: 1, vendorName: 1 }).lean();
  res.json({ clients: clients.map((c) => ({ id: c._id.toString(), name: c.name, vendorName: c.vendorName })) });
};
