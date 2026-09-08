const Task = require('../models/Task');
const { istDateString } = require('../utils/istDate');
const { recordAudit } = require('../utils/audit');

const STATUSES = ['pending', 'in_progress', 'completed'];
const MAX_NOTE_LENGTH = 1000;

function sanitize(task, employeeId) {
  return {
    id: task._id.toString(),
    title: task.title,
    description: task.description,
    site: task.site,
    siteLocation: task.siteLocation ? { lat: task.siteLocation.lat, lng: task.siteLocation.lng } : null,
    date: task.date,
    // Explicit fallbacks, not just the schema default — mine() uses .lean()
    // (skips Mongoose hydration entirely), so a task stored before this
    // field existed would otherwise come back as undefined instead of the
    // intended 'pending'.
    status: task.status || 'pending',
    completedAt: task.completedAt || null,
    // Everyone else assigned to the same task — useful since several
    // labourers often share one site for the day.
    coworkers: (task.employees || [])
      .filter((e) => e._id.toString() !== employeeId)
      .map((e) => ({ id: e._id.toString(), name: e.name, employeeId: e.employeeId })),
    // Oldest first — reads like a short conversation about this one task,
    // not a reverse-chronological log.
    notes: (task.notes || []).map((n) => ({
      id: n._id.toString(),
      authorName: n.authorName,
      text: n.text,
      createdAt: n.createdAt,
    })),
  };
}

const RANGES = ['all', 'past', 'today', 'upcoming'];

// Four tabs on the employee Tasks page — All, Past Work, Today's Work,
// Upcoming Work — each scoped strictly to this employee's own assignments
// and nothing else. Past and All sort most-recent-first, upcoming sorts
// soonest-first.
exports.mine = async (req, res) => {
  const range = RANGES.includes(req.query.range) ? req.query.range : 'today';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const today = istDateString();

  const filter = { employees: req.employee._id };
  let sort;
  if (range === 'past') {
    filter.date = { $lt: today };
    sort = { date: -1 };
  } else if (range === 'upcoming') {
    filter.date = { $gt: today };
    sort = { date: 1 };
  } else if (range === 'all') {
    sort = { date: -1 };
  } else {
    filter.date = today;
    sort = { date: 1 };
  }

  const [tasks, total] = await Promise.all([
    Task.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).populate('employees', 'name employeeId').lean(),
    Task.countDocuments(filter),
  ]);

  res.json({
    range,
    date: today,
    tasks: tasks.map((t) => sanitize(t, req.employee._id.toString())),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
};

// Only an employee this task is actually assigned to can move its status —
// scoped by the { employees: req.employee._id } filter, not just by id.
exports.updateStatus = async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ message: `status must be one of: ${STATUSES.join(', ')}.` });
  }

  const task = await Task.findOne({ _id: req.params.id, employees: req.employee._id });
  if (!task) return res.status(404).json({ message: 'Task not found.' });

  task.status = status;
  task.completedAt = status === 'completed' ? new Date() : null;
  task.completedBy = status === 'completed' ? req.employee._id : null;
  await task.save();
  await task.populate('employees', 'name employeeId');

  await recordAudit(req, {
    action: 'task.status_update',
    resourceType: 'Task',
    resourceId: task._id,
    summary: `${req.employee.name} marked "${task.title}" (${task.date}) as ${status.replace('_', ' ')}`,
  });

  res.json({ task: sanitize(task, req.employee._id.toString()) });
};

// Only an employee this task is actually assigned to can leave a note on it
// — same scoping as updateStatus above.
exports.addNote = async (req, res) => {
  const { text } = req.body;
  const trimmed = text ? String(text).trim() : '';
  if (!trimmed) {
    return res.status(400).json({ message: 'Note text is required.' });
  }
  if (trimmed.length > MAX_NOTE_LENGTH) {
    return res.status(400).json({ message: `Note must be ${MAX_NOTE_LENGTH} characters or fewer.` });
  }

  const task = await Task.findOne({ _id: req.params.id, employees: req.employee._id });
  if (!task) return res.status(404).json({ message: 'Task not found.' });
  if (task.status === 'completed') {
    return res.status(409).json({ message: 'This task is already completed — reopen it first to add a note.' });
  }

  task.notes.push({ author: req.employee._id, authorName: req.employee.name, text: trimmed });
  await task.save();
  await task.populate('employees', 'name employeeId');

  await recordAudit(req, {
    action: 'task.note_add',
    resourceType: 'Task',
    resourceId: task._id,
    summary: `${req.employee.name} added a note on "${task.title}" (${task.date})`,
  });

  res.json({ task: sanitize(task, req.employee._id.toString()) });
};
