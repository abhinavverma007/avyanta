const SalaryAdvance = require('../models/SalaryAdvance');
const { sanitize } = require('./salaryAdvance.controller');
const { recordAudit } = require('../utils/audit');
const { reviewerStamp } = require('../utils/reviewer');
const { deductMonthOf, monthLabel } = require('../utils/advanceMonth');
const { rejectSelfReview } = require('../utils/reviewGuard');
const { notifyEmployee } = require('../utils/notify');
const { checkOverridable, flipDecision, notifyOverride } = require('../utils/reviewOverride');

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
  if (req.query.employeeId) filter.employee = req.query.employeeId;

  const requests = await SalaryAdvance.find(filter)
    .populate('employee', 'name employeeId department')
    .sort({ createdAt: -1 })
    .lean();

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
  advance.reviewedBy = reviewerStamp(req);
  await advance.save();

  await recordAudit(req, {
    action: status === 'approved' ? 'advance.approve' : 'advance.reject',
    resourceType: 'SalaryAdvance',
    resourceId: advance._id,
    summary: status === 'approved'
      ? `Approved ${advance.employee?.name}'s advance of ₹${advance.amount} (to be deducted from ${monthLabel(deductMonthOf(advance))} salary)`
      : `Rejected ${advance.employee?.name}'s advance request of ₹${advance.amount}`,
  });

  // Not awaited — see the note in notify.js.
  notifyEmployee(advance.employee._id, {
    type: status === 'approved' ? 'advance.approved' : 'advance.rejected',
    title: `Your advance request of ₹${advance.amount} was ${status}`,
    body: advance.reviewNote || '',
    link: '/requests',
  });

  res.json({ request: withEmployee(advance) });
};

// Owner flips an advance decision a delegated Supervisor/Manager made. The
// deduction from the advance's salary month is derived live from `status`
// (salary.controller.js), so approved<->rejected needs no other bookkeeping;
// any payout already recorded just nets against the new payable as a balance.
exports.override = async (req, res) => {
  const targetStatus = req.body.status;
  const advance = await SalaryAdvance.findById(req.params.id).populate('employee', 'name employeeId department');
  if (!advance) return res.status(404).json({ message: 'Advance request not found.' });

  const problem = checkOverridable(req, advance, targetStatus);
  if (problem) return res.status(problem[0]).json({ message: problem[1] });

  const updated = await flipDecision(SalaryAdvance, req, advance, targetStatus, req.body.reviewNote);
  if (!updated) return res.status(409).json({ message: 'This request was changed by someone else — refresh and try again.' });
  updated.employee = advance.employee;

  await recordAudit(req, {
    action: 'advance.override',
    resourceType: 'SalaryAdvance',
    resourceId: advance._id,
    summary: `Overrode ${advance.reviewedBy.name}'s ${advance.status} decision on ${advance.employee.name}'s advance of ₹${advance.amount} — now ${targetStatus}`,
    metadata: { from: advance.status, to: targetStatus, previousReviewer: advance.reviewedBy.name },
  });

  notifyOverride({
    actorName: req.admin.name,
    kind: 'advance',
    section: 'advance',
    label: `advance request of ₹${advance.amount}`,
    previous: advance,
    doc: updated,
    employee: advance.employee,
  });

  res.json({ request: withEmployee(updated) });
};
