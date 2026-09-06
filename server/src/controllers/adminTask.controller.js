const Task = require('../models/Task');
const Employee = require('../models/Employee');
const { recordAudit } = require('../utils/audit');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function sanitize(task) {
  return {
    id: task._id.toString(),
    title: task.title,
    description: task.description,
    site: task.site,
    date: task.date,
    employees: (task.employees || []).map((e) => ({
      id: e._id.toString(),
      name: e.name,
      employeeId: e.employeeId,
    })),
    createdAt: task.createdAt,
  };
}

// One task per date × the same set of employees — a multi-day assignment
// becomes several documents, one per date, so an employee's "today" view
// (and the admin's filtered list) can just query by date.
exports.create = async (req, res) => {
  const { title, description, site, dates, employeeIds } = req.body;

  if (!title || !String(title).trim()) {
    return res.status(400).json({ message: 'Title is required.' });
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
      date,
      employees: employeeIds,
    })),
  );

  const populated = await Task.find({ _id: { $in: created.map((t) => t._id) } })
    .populate('employees', 'name employeeId')
    .sort({ date: 1 });

  await recordAudit(req, {
    action: 'task.create',
    resourceType: 'Task',
    resourceId: created[0]?._id,
    summary: `Assigned "${String(title).trim()}" to ${employees.length} employee(s) across ${uniqueDates.length} day(s)`,
    metadata: { dates: uniqueDates, employeeIds },
  });

  res.status(201).json({ tasks: populated.map(sanitize) });
};

exports.list = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const filter = {};
  if (req.query.date) filter.date = req.query.date;
  if (req.query.employeeId) filter.employees = req.query.employeeId;

  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .populate('employees', 'name employeeId')
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
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
