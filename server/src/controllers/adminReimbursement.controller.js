const Reimbursement = require('../models/Reimbursement');
const { sanitize } = require('./reimbursement.controller');
const { recordAudit } = require('../utils/audit');
const { reviewerStamp } = require('../utils/reviewer');
const { rejectSelfReview } = require('../utils/reviewGuard');
const { notifyEmployee } = require('../utils/notify');
const { checkOverridable, flipDecision, notifyOverride } = require('../utils/reviewOverride');

function monthRange(year, month) {
  const pad = (n) => String(n).padStart(2, '0');
  const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(daysInMonth)}`,
  };
}

function withEmployee(claim) {
  return {
    ...sanitize(claim),
    employee: claim.employee
      ? {
          id: claim.employee._id.toString(),
          name: claim.employee.name,
          employeeId: claim.employee.employeeId,
          department: claim.employee.department,
        }
      : null,
  };
}

exports.list = async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.employeeId) filter.employee = req.query.employeeId;
  if (req.query.year && req.query.month) {
    const { start, end } = monthRange(req.query.year, req.query.month);
    filter.date = { $gte: start, $lte: end };
  }

  const claims = await Reimbursement.find(filter)
    .populate('employee', 'name employeeId department')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ claims: claims.map(withEmployee) });
};

exports.review = (status) => async (req, res) => {
  const claim = await Reimbursement.findById(req.params.id).populate('employee', 'name employeeId department');
  if (!claim) return res.status(404).json({ message: 'Claim not found.' });
  if (claim.status !== 'pending') {
    return res.status(409).json({ message: `Claim already ${claim.status}.` });
  }
  if (rejectSelfReview(req, res, claim.employee._id)) return;

  claim.status = status;
  claim.reviewNote = req.body.reviewNote || '';
  claim.reviewedAt = new Date();
  claim.reviewedBy = reviewerStamp(req);
  await claim.save();

  await recordAudit(req, {
    action: status === 'approved' ? 'reimbursement.approve' : 'reimbursement.reject',
    resourceType: 'Reimbursement',
    resourceId: claim._id,
    summary: `${status === 'approved' ? 'Approved' : 'Rejected'} ${claim.employee?.name}'s ${claim.category} claim of ₹${claim.amount}`,
  });

  // Not awaited — see the note in notify.js.
  notifyEmployee(claim.employee._id, {
    type: status === 'approved' ? 'reimbursement.approved' : 'reimbursement.rejected',
    title: `Your ${claim.category} claim of ₹${claim.amount} was ${status}`,
    body: claim.reviewNote || '',
    link: '/requests',
  });

  res.json({ claim: withEmployee(claim) });
};

// Owner flips a reimbursement decision a delegated Supervisor/Manager made.
// The amount added to that month's salary is derived live from `status`
// (salary.controller.js), so no other bookkeeping is needed.
exports.override = async (req, res) => {
  const targetStatus = req.body.status;
  const claim = await Reimbursement.findById(req.params.id).populate('employee', 'name employeeId department');
  if (!claim) return res.status(404).json({ message: 'Claim not found.' });

  const problem = checkOverridable(req, claim, targetStatus);
  if (problem) return res.status(problem[0]).json({ message: problem[1] });

  const updated = await flipDecision(Reimbursement, req, claim, targetStatus, req.body.reviewNote);
  if (!updated) return res.status(409).json({ message: 'This claim was changed by someone else — refresh and try again.' });
  updated.employee = claim.employee;

  await recordAudit(req, {
    action: 'reimbursement.override',
    resourceType: 'Reimbursement',
    resourceId: claim._id,
    summary: `Overrode ${claim.reviewedBy.name}'s ${claim.status} decision on ${claim.employee.name}'s ${claim.category} claim of ₹${claim.amount} — now ${targetStatus}`,
    metadata: { from: claim.status, to: targetStatus, previousReviewer: claim.reviewedBy.name },
  });

  notifyOverride({
    actorName: req.admin.name,
    kind: 'reimbursement',
    section: 'reimbursements',
    label: `${claim.category} claim of ₹${claim.amount}`,
    previous: claim,
    doc: updated,
    employee: claim.employee,
  });

  res.json({ claim: withEmployee(updated) });
};
