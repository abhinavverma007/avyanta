const SalaryAdvance = require('../models/SalaryAdvance');
const { sanitize } = require('./salaryAdvance.controller');
const { recordAudit } = require('../utils/audit');
const { rejectSelfReview } = require('../utils/reviewGuard');

function withEmployee(advance) {
  return {
    ...sanitize(advance),
    employee: advance.employee
      ? {
          id: advance.employee._id.toString(),
          name: advance.employee.name,
          employeeId: advance.employee.employeeId,
          department: advance.employee.department,
        }
      : null,
  };
}

exports.list = async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  const requests = await SalaryAdvance.find(filter)
    .populate('employee', 'name employeeId department')
    .sort({ createdAt: -1 });

  res.json({ requests: requests.map(withEmployee) });
};

exports.review = (status) => async (req, res) => {
  const advance = await SalaryAdvance.findById(req.params.id).populate('employee', 'name employeeId department');
  if (!advance) return res.status(404).json({ message: 'Advance request not found.' });
  if (advance.status !== 'pending') {
    return res.status(409).json({ message: `Request already ${advance.status}.` });
  }
  if (rejectSelfReview(req, res, advance.employee._id)) return;

  advance.status = status;
  advance.reviewNote = req.body.reviewNote || '';
  advance.reviewedAt = new Date();
  await advance.save();

  await recordAudit(req, {
    action: status === 'approved' ? 'advance.approve' : 'advance.reject',
    resourceType: 'SalaryAdvance',
    resourceId: advance._id,
    summary: status === 'approved'
      ? `Approved ${advance.employee?.name}'s advance of ₹${advance.amount} (to be deducted from next month's salary)`
      : `Rejected ${advance.employee?.name}'s advance request of ₹${advance.amount}`,
  });

  res.json({ request: withEmployee(advance) });
};
