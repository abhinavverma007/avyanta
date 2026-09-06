const Leave = require('../models/Leave');
const { sanitize } = require('./leave.controller');
const { recordAudit } = require('../utils/audit');

function monthRange(year, month) {
  const pad = (n) => String(n).padStart(2, '0');
  const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(daysInMonth)}`,
  };
}

function withEmployee(leave) {
  return {
    ...sanitize(leave),
    employee: leave.employee
      ? {
          id: leave.employee._id.toString(),
          name: leave.employee.name,
          employeeId: leave.employee.employeeId,
          department: leave.employee.department,
        }
      : null,
  };
}

exports.list = async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.year && req.query.month) {
    const { start, end } = monthRange(req.query.year, req.query.month);
    filter.date = { $gte: start, $lte: end };
  }

  const leaves = await Leave.find(filter)
    .populate('employee', 'name employeeId department')
    .sort({ createdAt: -1 });

  res.json({ leaves: leaves.map(withEmployee) });
};

exports.review = (status) => async (req, res) => {
  const leave = await Leave.findById(req.params.id).populate('employee', 'name employeeId department');
  if (!leave) return res.status(404).json({ message: 'Leave request not found.' });
  if (leave.status !== 'pending') {
    return res.status(409).json({ message: `Leave request already ${leave.status}.` });
  }

  leave.status = status;
  leave.reviewNote = req.body.reviewNote || '';
  leave.reviewedAt = new Date();
  await leave.save();

  await recordAudit(req, {
    action: status === 'approved' ? 'leave.approve' : 'leave.reject',
    resourceType: 'Leave',
    resourceId: leave._id,
    summary: `${status === 'approved' ? 'Approved' : 'Rejected'} ${leave.employee?.name}'s leave for ${leave.date}`,
  });

  res.json({ leave: withEmployee(leave) });
};
