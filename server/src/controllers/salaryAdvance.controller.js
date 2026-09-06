const SalaryAdvance = require('../models/SalaryAdvance');
const { istDateString } = require('../utils/istDate');
const { recordAudit } = require('../utils/audit');

function sanitize(a) {
  return {
    id: a._id.toString(),
    amount: a.amount,
    reason: a.reason,
    requestedDate: a.requestedDate,
    status: a.status,
    reviewNote: a.reviewNote,
    reviewedAt: a.reviewedAt,
    createdAt: a.createdAt,
  };
}

exports.mine = async (req, res) => {
  const requests = await SalaryAdvance.find({ employee: req.employee._id }).sort({ createdAt: -1 });
  res.json({ requests: requests.map(sanitize) });
};

// Deducted from the salary of the month right after today (see
// salary.controller.js) — capped at one month's salary so a single advance
// can never demand more than the employee could plausibly earn back.
exports.create = async (req, res) => {
  const { amount, reason } = req.body;

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ message: 'Amount must be greater than 0.' });
  }
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ message: 'A reason is required.' });
  }
  const cap = req.employee.salaryMonthly || 0;
  if (Number(amount) > cap) {
    return res.status(400).json({ message: `Advance amount can't exceed your monthly salary of ₹${cap}.` });
  }

  const advance = await SalaryAdvance.create({
    employee: req.employee._id,
    amount: Number(amount),
    reason: String(reason).trim(),
    requestedDate: istDateString(),
  });

  await recordAudit(req, {
    action: 'advance.apply',
    resourceType: 'SalaryAdvance',
    resourceId: advance._id,
    summary: `${req.employee.name} requested an advance of ₹${advance.amount}`,
  });

  res.status(201).json({ request: sanitize(advance) });
};

exports.sanitize = sanitize;
