const SalaryAdvance = require('../models/SalaryAdvance');
const { istDateString } = require('../utils/istDate');
const { deductMonthOf } = require('../utils/advanceMonth');
const { sanitizeOverride } = require('../utils/reviewOverride');
const { recordAudit } = require('../utils/audit');
const { notifyReviewers } = require('../utils/notify');

function sanitize(a) {
  return {
    id: a._id.toString(),
    amount: a.amount,
    reason: a.reason,
    requestedDate: a.requestedDate,
    // Always present in the response — for older advances it's the month after requestedDate.
    deductMonth: deductMonthOf(a),
    status: a.status,
    reviewNote: a.reviewNote,
    reviewedAt: a.reviewedAt,
    override: sanitizeOverride(a.override),
    reviewedBy: a.reviewedBy && a.reviewedBy.name
      ? { id: String(a.reviewedBy.id), name: a.reviewedBy.name, actorType: a.reviewedBy.actorType }
      : null,
    createdAt: a.createdAt,
  };
}

exports.mine = async (req, res) => {
  const requests = await SalaryAdvance.find({ employee: req.employee._id }).sort({ createdAt: -1 });
  res.json({ requests: requests.map(sanitize) });
};

// Deducted from this month's salary — the month it's requested in (see
// salary.controller.js). No cap on the amount — the reviewer decides.
exports.create = async (req, res) => {
  const { amount, reason } = req.body;

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ message: 'Amount must be greater than 0.' });
  }
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ message: 'A reason is required.' });
  }

  const today = istDateString();
  const advance = await SalaryAdvance.create({
    employee: req.employee._id,
    amount: Number(amount),
    reason: String(reason).trim(),
    requestedDate: today,
    deductMonth: today.slice(0, 7), // deducted from the month it's requested in
  });

  await recordAudit(req, {
    action: 'advance.apply',
    resourceType: 'SalaryAdvance',
    resourceId: advance._id,
    summary: `${req.employee.name} requested an advance of ₹${advance.amount}`,
  });

  // Not awaited — see the note in notify.js.
  notifyReviewers({
    permissionKey: 'approvalsAdvance',
    excludeEmployeeId: req.employee._id,
    type: 'advance.submitted',
    title: `${req.employee.name} requested a salary advance`,
    body: `₹${advance.amount} — ${advance.reason}`,
    link: `/superadmin/approvals?section=advance&employee=${req.employee.employeeId}`,
  });

  res.status(201).json({ request: sanitize(advance) });
};

exports.sanitize = sanitize;
