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

// How many of this employee's monthly leave quota are left, for a given month.
exports.summary = async (req, res) => {
  const { year, month } = resolveYearMonth(req);
  const { start, end } = monthRange(year, month);

  const taken = await Leave.countDocuments({
    employee: req.employee._id,
    date: { $gte: start, $lte: end },
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
    leaves: leaves.map((l) => ({ date: l.date, reason: l.reason })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
};

// No leave "types" and no approval step — the monthly quota the superadmin
// sets on the employee's profile is the only gate. A request that fits
// within the remaining quota for every month it touches is applied
// immediately; one that doesn't is rejected outright (never partially).
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
  const existingLeaveDates = new Set(existingLeaves.map((l) => l.date));

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
      { $set: { reason: trimmedReason } },
      { upsert: true, new: true },
    );
    results.push(rec);
  }

  res.status(201).json({ leaves: results.map((r) => ({ date: r.date, reason: r.reason })) });
};
