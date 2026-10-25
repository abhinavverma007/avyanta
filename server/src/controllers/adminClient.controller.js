const Client = require('../models/Client');
const Task = require('../models/Task');
const DailyReport = require('../models/DailyReport');
const { recordAudit } = require('../utils/audit');
const { generateClientCode, ensureClientCodes } = require('../utils/clientCode');
const { sanitize: sanitizeTask } = require('./adminTask.controller');

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitize(client, taskCount = 0, lastServiced = null) {
  return {
    id: client._id.toString(),
    clientCode: client.clientCode ?? '',
    name: client.name,
    vendorName: client.vendorName,
    mobileNumber: client.mobileNumber ?? '',
    address: client.address ?? '',
    addressLocation:
      client.addressLocation && client.addressLocation.lat != null && client.addressLocation.lng != null
        ? { lat: client.addressLocation.lat, lng: client.addressLocation.lng }
        : null,
    email: client.email ?? '',
    wifiEmail: client.wifiEmail ?? '',
    wifiPassword: client.wifiPassword ?? '',
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

function sameLocation(a, b) {
  const hasA = !!a && a.lat != null && a.lng != null;
  const hasB = !!b && b.lat != null && b.lng != null;
  if (!hasA && !hasB) return true;
  if (hasA !== hasB) return false;
  return a.lat === b.lat && a.lng === b.lng;
}

function readFields(body) {
  const name = String(body.name ?? '').trim();
  const vendorName = String(body.vendorName ?? '').trim();
  if (!name) return { error: 'Client name is required.' };
  if (!vendorName) return { error: 'Vendor name is required.' };
  if (name.length > 120 || vendorName.length > 120) return { error: 'Names can be at most 120 characters.' };
  return { name, vendorName };
}

const OPTIONAL_FIELDS = ['mobileNumber', 'address', 'addressLocation', 'email', 'wifiEmail', 'wifiPassword'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// The optional details. Only keys actually present in the request are returned, so an
// older page that doesn't send them can never wipe what's stored; an empty string is a
// deliberate "clear this". All of them may be left blank.
function readOptional(body) {
  const has = (k) => body[k] !== undefined && body[k] !== null;
  const out = {};

  if (has('mobileNumber')) {
    const v = String(body.mobileNumber).replace(/[\s\-().]/g, ''); // "+91 98765-43210" -> "+919876543210"
    if (v && !/^\+?\d{7,15}$/.test(v)) return { error: 'Mobile number must be 7 to 15 digits (a leading + is fine).' };
    out.mobileNumber = v;
  }
  for (const [key, label] of [['email', 'Email'], ['wifiEmail', 'Wi-Fi configuration email']]) {
    if (has(key)) {
      const v = String(body[key]).trim();
      if (v && (v.length > 254 || !EMAIL_RE.test(v))) return { error: `${label} doesn't look like a valid email address.` };
      out[key] = v;
    }
  }
  if (has('address')) {
    const v = String(body.address).trim();
    if (v.length > 500) return { error: 'Address can be at most 500 characters.' };
    out.address = v;
  }
  // The map pin for the address. null (or an empty object) clears it.
  if (body.addressLocation !== undefined) {
    const loc = body.addressLocation;
    if (loc === null || (typeof loc === 'object' && loc.lat == null && loc.lng == null)) {
      out.addressLocation = null;
    } else {
      const lat = Number(loc && loc.lat);
      const lng = Number(loc && loc.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return { error: 'The map location is not valid.' };
      }
      out.addressLocation = { lat, lng };
    }
  }
  if (has('wifiPassword')) {
    const raw = String(body.wifiPassword);
    if (raw.length > 200) return { error: 'Wi-Fi password can be at most 200 characters.' };
    out.wifiPassword = raw.trim() === '' ? '' : raw; // kept exactly as typed — not trimmed
  }
  return { extras: out };
}

// Owner-only (see adminClients.routes.js) — the Assign Task dropdown reads
// clients through the tasks router instead, so a delegated Supervisor can
// pick a client without being able to manage them.
exports.list = async (req, res) => {
  await ensureClientCodes(); // numbers any client that predates codes, oldest first
  const [clients, counts] = await Promise.all([
    Client.find().sort({ name: 1, vendorName: 1 }).lean(),
    Task.aggregate([{ $match: { client: { $ne: null } } }, { $group: { _id: '$client', n: { $sum: 1 }, last: { $max: '$date' } } }]),
  ]);
  const byClient = new Map(counts.map((c) => [String(c._id), c]));
  res.json({ clients: clients.map((c) => sanitize(c, byClient.get(String(c._id))?.n || 0, byClient.get(String(c._id))?.last || null)) });
};

// One client — so the Edit page can load straight from its URL (e.g. on a refresh), not only
// from the list already in memory. Owner-only like the rest.
exports.getOne = async (req, res) => {
  await ensureClientCodes();
  const client = await Client.findById(req.params.id).catch(() => null);
  if (!client) return res.status(404).json({ message: 'Client not found.' });
  res.json({ client: sanitize(client, await Task.countDocuments({ client: client._id })) });
};

exports.create = async (req, res) => {
  const fields = readFields(req.body);
  if (fields.error) return res.status(400).json({ message: fields.error });
  const optional = readOptional(req.body);
  if (optional.error) return res.status(400).json({ message: optional.error });
  if (await findDuplicate(fields.name, fields.vendorName)) {
    return res.status(409).json({ message: `${fields.name} with vendor ${fields.vendorName} already exists.` });
  }

  // Number any older clients first, so a new client never takes a lower number than one that was added before it.
  await ensureClientCodes();
  const clientCode = await generateClientCode();
  const extras = { ...optional.extras };
  if (extras.addressLocation === null) delete extras.addressLocation;
  const client = await Client.create({ clientCode, name: fields.name, vendorName: fields.vendorName, ...extras });

  await recordAudit(req, {
    action: 'client.create',
    resourceType: 'Client',
    resourceId: client._id,
    summary: `Added client ${client.clientCode} "${client.name}" (vendor: ${client.vendorName})`,
    // Which optional details were filled in — never their values (one is a password).
    metadata: { clientCode: client.clientCode, optionalProvided: OPTIONAL_FIELDS.filter((k) => client[k]) },
  });

  res.status(201).json({ client: sanitize(client) });
};

exports.update = async (req, res) => {
  const client = await Client.findById(req.params.id);
  if (!client) return res.status(404).json({ message: 'Client not found.' });

  const fields = readFields(req.body);
  if (fields.error) return res.status(400).json({ message: fields.error });
  const optional = readOptional(req.body);
  if (optional.error) return res.status(400).json({ message: optional.error });
  const unchanged = (k) =>
    k === 'addressLocation' ? sameLocation(client.addressLocation, optional.extras.addressLocation) : (client[k] ?? '') === optional.extras[k];
  const changedOptional = Object.keys(optional.extras).filter((k) => !unchanged(k));
  if (fields.name === client.name && fields.vendorName === client.vendorName && changedOptional.length === 0) {
    return res.status(409).json({ message: 'Nothing changed.' });
  }
  if (await findDuplicate(fields.name, fields.vendorName, client._id)) {
    return res.status(409).json({ message: `${fields.name} with vendor ${fields.vendorName} already exists.` });
  }

  const before = { name: client.name, vendorName: client.vendorName };
  client.name = fields.name;
  client.vendorName = fields.vendorName;
  for (const k of changedOptional) client[k] = optional.extras[k] === null ? undefined : optional.extras[k];
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
    summary: `Updated client ${client.clientCode || ''} "${before.name}" (vendor: ${before.vendorName}) → "${client.name}" (vendor: ${client.vendorName})`.replace('client  ', 'client '),
    // Optional details: only WHICH ones changed, never the values (one is a password).
    metadata: { before, after: { name: client.name, vendorName: client.vendorName }, tasksRenamed, optionalChanged: changedOptional },
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
    summary: `Deleted client ${client.clientCode || ''} "${client.name}" (vendor: ${client.vendorName})`.replace('client  ', 'client '),
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
  await ensureClientCodes();
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
    client: { id: client._id.toString(), clientCode: client.clientCode ?? '', name: client.name, vendorName: client.vendorName },
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

// For the Assign Task dropdown — anyone allowed to assign tasks (owner, or a Supervisor with the
// Tasks permission) can read the list, nothing more. A client is identified here by its code
// and its vendor only (CD-0001 — Satya Solar); the client's name isn't sent at all.
exports.listForTasks = async (req, res) => {
  await ensureClientCodes();
  const clients = await Client.find().sort({ clientCode: 1 }).lean();
  res.json({ clients: clients.map((c) => ({ id: c._id.toString(), clientCode: c.clientCode ?? '', vendorName: c.vendorName })) });
};
