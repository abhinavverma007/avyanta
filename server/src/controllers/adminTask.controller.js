const Task = require('../models/Task');
const Employee = require('../models/Employee');
const { recordAudit } = require('../utils/audit');
const { sendPushToEmployees } = require('../utils/pushNotify');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ['pending', 'in_progress', 'completed'];

// Escapes regex metacharacters so free-text search is matched literally —
// otherwise a search string like "a+b (site)" would be interpreted as a
// regex pattern instead of the literal text the owner typed.
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitize(task) {
  return {
    id: task._id.toString(),
    title: task.title,
    description: task.description,
    site: task.site,
    siteLocation: task.siteLocation ? { lat: task.siteLocation.lat, lng: task.siteLocation.lng } : null,
    date: task.date,
    // Explicit fallbacks, not just the schema default — .lean() (used below
    // for read-only queries) skips Mongoose hydration entirely, so a task
    // stored before this field existed would otherwise come back as
    // undefined instead of the intended 'pending'.
    status: task.status || 'pending',
    completedAt: task.completedAt || null,
    completedBy: task.completedBy && task.completedBy._id ? { id: task.completedBy._id.toString(), name: task.completedBy.name } : null,
    employees: (task.employees || []).map((e) => ({
      id: e._id.toString(),
      name: e.name,
      employeeId: e.employeeId,
    })),
    notes: (task.notes || []).map((n) => ({
      id: n._id.toString(),
      authorName: n.authorName,
      text: n.text,
      createdAt: n.createdAt,
    })),
    createdAt: task.createdAt,
  };
}

// One task per date × the same set of employees — a multi-day assignment
// becomes several documents, one per date, so an employee's "today" view
// (and the admin's filtered list) can just query by date.
exports.create = async (req, res) => {
  const { title, description, site, siteLocation, dates, employeeIds } = req.body;

  if (!title || !String(title).trim()) {
    return res.status(400).json({ message: 'Title is required.' });
  }
  let cleanLocation;
  if (siteLocation != null) {
    const lat = Number(siteLocation.lat);
    const lng = Number(siteLocation.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ message: 'siteLocation must have valid lat/lng.' });
    }
    cleanLocation = { lat, lng };
  }
  if (!Array.isArray(dates) || dates.length === 0) {
    return res.status(400).json({ message: 'At least one date is required.' });
  }
  if (!dates.every((d) => typeof d === 'string' && DATE_RE.test(d))) {
    return res.status(400).json({ message: 'Dates must be in YYYY-MM-DD format.' });
  }
  if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
    return res.status(400).json({ message: 'At least one employee must be assigned.' });
  }

  const employees = await Employee.find({ _id: { $in: employeeIds } });
  if (employees.length !== employeeIds.length) {
    return res.status(400).json({ message: 'One or more selected employees were not found.' });
  }

  const uniqueDates = [...new Set(dates)].sort();
  const created = await Task.insertMany(
    uniqueDates.map((date) => ({
      title: String(title).trim(),
      description: description ? String(description).trim() : '',
      site: site ? String(site).trim() : '',
      siteLocation: cleanLocation,
      date,
      employees: employeeIds,
    })),
  );

  const populated = await Task.find({ _id: { $in: created.map((t) => t._id) } })
    .populate('employees', 'name employeeId')
    .populate('completedBy', 'name employeeId')
    .sort({ date: 1 })
    .lean();

  await recordAudit(req, {
    action: 'task.create',
    resourceType: 'Task',
    resourceId: created[0]?._id,
    summary: `Assigned "${String(title).trim()}" to ${employees.length} employee(s) across ${uniqueDates.length} day(s)`,
    metadata: { dates: uniqueDates, employeeIds },
  });

  // Not awaited — push delivery is an external network call to a third-party
  // service and must never add its latency to the owner's response.
  sendPushToEmployees(employeeIds, {
    title: 'New task assigned',
    body: `${String(title).trim()}${uniqueDates.length > 1 ? ` — ${uniqueDates.length} day(s)` : ` on ${uniqueDates[0]}`}`,
    url: '/tasks',
  });

  res.status(201).json({ tasks: populated.map(sanitize) });
};

exports.list = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const filter = {};
  const andConditions = [];

  if (req.query.date) filter.date = req.query.date;
  if (req.query.employeeId) filter.employees = req.query.employeeId;
  if (req.query.status) {
    // Tasks created before this field existed have no stored `status` at
    // all — Mongoose's schema default papers over that on reads, but a raw
    // query for status:'pending' would otherwise silently exclude them.
    if (req.query.status === 'pending') {
      andConditions.push({ $or: [{ status: 'pending' }, { status: { $exists: false } }] });
    } else {
      filter.status = req.query.status;
    }
  }
  if (req.query.search) {
    const pattern = new RegExp(escapeRegex(String(req.query.search).trim()), 'i');
    andConditions.push({ $or: [{ title: pattern }, { site: pattern }] });
  }
  if (andConditions.length > 0) filter.$and = andConditions;

  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .populate('employees', 'name employeeId')
      .populate('completedBy', 'name employeeId')
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Task.countDocuments(filter),
  ]);

  res.json({
    tasks: tasks.map(sanitize),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
};

// Needed so the Edit Task page can load a task directly by its URL (e.g. on
// a refresh), not just from the list already in memory on the history page.
exports.getOne = async (req, res) => {
  const task = await Task.findById(req.params.id)
    .populate('employees', 'name employeeId')
    .populate('completedBy', 'name employeeId')
    .lean();
  if (!task) return res.status(404).json({ message: 'Task not found.' });
  res.json({ task: sanitize(task) });
};

// Edits a single existing date's task document — dates/employees were
// created per-day (see create() above), so an edit only ever touches one
// document at a time, never a whole multi-day assignment at once.
exports.update = async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: 'Task not found.' });

  const { title, description, site, siteLocation, date, employeeIds, status } = req.body;

  if (title !== undefined) {
    if (!String(title).trim()) return res.status(400).json({ message: 'Title is required.' });
    task.title = String(title).trim();
  }
  if (description !== undefined) task.description = String(description).trim();
  if (site !== undefined) task.site = String(site).trim();
  if (siteLocation !== undefined) {
    if (siteLocation === null) {
      task.siteLocation = undefined;
    } else {
      const lat = Number(siteLocation.lat);
      const lng = Number(siteLocation.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ message: 'siteLocation must have valid lat/lng.' });
      }
      task.siteLocation = { lat, lng };
    }
  }
  if (date !== undefined) {
    if (typeof date !== 'string' || !DATE_RE.test(date)) {
      return res.status(400).json({ message: 'Date must be in YYYY-MM-DD format.' });
    }
    task.date = date;
  }
  let newlyAddedEmployeeIds = [];
  if (employeeIds !== undefined) {
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({ message: 'At least one employee must be assigned.' });
    }
    const employees = await Employee.find({ _id: { $in: employeeIds } });
    if (employees.length !== employeeIds.length) {
      return res.status(400).json({ message: 'One or more selected employees were not found.' });
    }
    const previousEmployeeIds = task.employees.map((id) => id.toString());
    newlyAddedEmployeeIds = employeeIds.filter((id) => !previousEmployeeIds.includes(id));
    task.employees = employeeIds;
  }
  if (status !== undefined) {
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${STATUSES.join(', ')}.` });
    }
    task.status = status;
    // An owner-driven status change isn't attributed to any one assigned
    // employee — completedBy stays null; it's only set via the employee's
    // own status-update endpoint (see task.controller.js).
    task.completedAt = status === 'completed' ? new Date() : null;
    task.completedBy = null;
  }

  await task.save();
  const populated = await Task.findById(task._id)
    .populate('employees', 'name employeeId')
    .populate('completedBy', 'name employeeId')
    .lean();

  await recordAudit(req, {
    action: 'task.update',
    resourceType: 'Task',
    resourceId: task._id,
    summary: `Updated task "${populated.title}" for ${populated.date}`,
  });

  // Not awaited — see the note in create() above.
  if (newlyAddedEmployeeIds.length > 0) {
    sendPushToEmployees(newlyAddedEmployeeIds, {
      title: 'New task assigned',
      body: `${populated.title} on ${populated.date}`,
      url: '/tasks',
    });
  }

  res.json({ task: sanitize(populated) });
};

exports.remove = async (req, res) => {
  const task = await Task.findByIdAndDelete(req.params.id);
  if (!task) return res.status(404).json({ message: 'Task not found.' });

  await recordAudit(req, {
    action: 'task.delete',
    resourceType: 'Task',
    resourceId: task._id,
    summary: `Removed task "${task.title}" for ${task.date}`,
  });

  res.json({ success: true });
};
