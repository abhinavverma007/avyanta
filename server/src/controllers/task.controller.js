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

// Deliberately today-only — no upcoming/future tasks are ever returned here.
exports.today = async (req, res) => {
  const today = istDateString();
  const tasks = await Task.find({ employees: req.employee._id, date: today }).populate('employees', 'name employeeId');
  res.json({ date: today, tasks: tasks.map((t) => sanitize(t, req.employee._id.toString())) });
};
