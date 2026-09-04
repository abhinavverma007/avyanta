const Leave = require('../models/Leave');
const Attendance = require('../models/Attendance');
const { istNow } = require('../utils/istDate');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad(n) {
  return String(n).padStart(2, '0');
}

function monthRange(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(daysInMonth)}`,
  };
}

function resolveYearMonth(req) {
  const now = istNow();
  const year = parseInt(req.query.year, 10) || now.getUTCFullYear();
  const month = parseInt(req.query.month, 10) || now.getUTCMonth() + 1;
  return { year, month };
}

function sanitize(l) {
  return {
    id: l._id.toString(),
    date: l.date,
    reason: l.reason,
    status: l.status,
    reviewNote: l.reviewNote,
    reviewedAt: l.reviewedAt,
  };
}

// Pending requests reserve quota the same as approved ones — otherwise an
// employee could apply well past their quota while requests sit unreviewed.
// Rejected requests free the quota back up entirely.
const RESERVES_QUOTA = { $in: ['pending', 'approved'] };

// How many of this employee's monthly leave quota are left, for a given month.
exports.summary = async (req, res) => {
  const { year, month } = resolveYearMonth(req);
  const { start, end } = monthRange(year, month);

  const taken = await Leave.countDocuments({
    employee: req.employee._id,
    date: { $gte: start, $lte: end },
    status: RESERVES_QUOTA,
  });
  const quota = req.employee.paidLeavesPerMonth || 0;

  res.json({ year, month, quota, taken, remaining: Math.max(0, quota - taken) });
};

exports.mine = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const filter = { employee: req.employee._id };

  const [leaves, total] = await Promise.all([
    Leave.find(filter).sort({ date: -1 }).skip((page - 1) * limit).limit(limit),
    Leave.countDocuments(filter),
  ]);

  res.json({
    leaves: leaves.map(sanitize),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
};

// No leave "types" — the monthly quota the superadmin sets on the employee's
// profile is the only gate on how many days can be requested. A request that
// fits within the remaining quota for every month it touches is created as
// 'pending' and waits for the superadmin to approve or reject it (see
// adminLeave.controller.js); one that doesn't fit is rejected outright at
// request time (never partially).
exports.create = async (req, res) => {
  const { dates, reason } = req.body;

  if (!Array.isArray(dates) || dates.length === 0) {
    return res.status(400).json({ message: 'At least one date is required.' });
  }
  if (!dates.every((d) => typeof d === 'string' && DATE_RE.test(d))) {
    return res.status(400).json({ message: 'Dates must be in YYYY-MM-DD format.' });
  }
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ message: 'A reason is required.' });
  }

  const uniqueDates = [...new Set(dates)].sort();
  const trimmedReason = String(reason).trim();
  const quota = req.employee.paidLeavesPerMonth || 0;

  const punchedDays = await Attendance.find({ employee: req.employee._id, date: { $in: uniqueDates } });
  for (const rec of punchedDays) {
    if (rec.sessions.length > 0) {
      return res.status(409).json({ message: `${rec.date} already has attendance recorded and can't be marked as leave.` });
    }
  }

  const existingLeaves = await Leave.find({ employee: req.employee._id, date: { $in: uniqueDates } });
  const alreadyApproved = existingLeaves.find((l) => l.status === 'approved');
  if (alreadyApproved) {
    return res.status(409).json({ message: `${alreadyApproved.date} is already an approved leave.` });
  }
  const existingLeaveDates = new Set(existingLeaves.filter((l) => l.status !== 'rejected').map((l) => l.date));

  const byMonth = new Map();
  for (const d of uniqueDates) {
    const key = d.slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(d);
  }

  for (const [key, monthDates] of byMonth) {
    const [y, m] = key.split('-').map(Number);
    const { start, end } = monthRange(y, m);
    const alreadyTaken = await Leave.countDocuments({
      employee: req.employee._id,
      date: { $gte: start, $lte: end, $nin: monthDates },
      status: RESERVES_QUOTA,
    });
    const newInThisMonth = monthDates.filter((d) => !existingLeaveDates.has(d)).length;
    if (alreadyTaken + newInThisMonth > quota) {
      return res.status(409).json({
        message: `Only ${Math.max(0, quota - alreadyTaken)} leave day(s) left for ${key}.`,
      });
    }
  }

  const results = [];
  for (const d of uniqueDates) {
    const rec = await Leave.findOneAndUpdate(
      { employee: req.employee._id, date: d },
      { $set: { reason: trimmedReason, status: 'pending', reviewNote: '', reviewedAt: null } },
      { upsert: true, new: true },
    );
    results.push(rec);
  }

  res.status(201).json({ leaves: results.map(sanitize) });
};

exports.sanitize = sanitize;
