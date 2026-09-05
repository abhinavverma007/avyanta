const Task = require('../models/Task');
const { istDateString } = require('../utils/istDate');

function sanitize(task, employeeId) {
  return {
    id: task._id.toString(),
    title: task.title,
    description: task.description,
    site: task.site,
    date: task.date,
    // Everyone else assigned to the same task — useful since several
    // labourers often share one site for the day.
    coworkers: (task.employees || [])
      .filter((e) => e._id.toString() !== employeeId)
      .map((e) => ({ id: e._id.toString(), name: e.name, employeeId: e.employeeId })),
  };
}

const RANGES = ['past', 'today', 'upcoming'];

// Three tabs on the employee Tasks page — Past Work, Today's Work, Upcoming
// Work — each scoped strictly to this employee's own assignments and
// nothing else. Past sorts most-recent-first, upcoming sorts soonest-first.
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
  } else {
    filter.date = today;
    sort = { date: 1 };
  }

  const [tasks, total] = await Promise.all([
    Task.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).populate('employees', 'name employeeId'),
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
