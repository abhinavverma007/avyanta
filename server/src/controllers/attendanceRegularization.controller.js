const AttendanceRegularization = require('../models/AttendanceRegularization');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const { istDateString } = require('../utils/istDate');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function sanitize(r) {
  return {
    id: r._id.toString(),
    date: r.date,
    reason: r.reason,
    requestedCheckIn: r.requestedCheckIn,
    requestedCheckOut: r.requestedCheckOut,
    status: r.status,
    reviewNote: r.reviewNote,
    reviewedAt: r.reviewedAt,
  };
}

exports.mine = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const filter = { employee: req.employee._id };

  const [requests, total] = await Promise.all([
    AttendanceRegularization.find(filter).sort({ date: -1 }).skip((page - 1) * limit).limit(limit),
    AttendanceRegularization.countDocuments(filter),
  ]);

  res.json({
    requests: requests.map(sanitize),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
};

// Only for a day with no valid attendance already on it (forgot to punch,
// or punched in and never out) — a day that's already fully present has
// nothing to regularize, and a day that's on approved leave isn't a working
// day at all. Requests wait for the superadmin to approve or reject (see
// adminAttendanceRegularization.controller.js); approving is what actually
// writes the corrected Attendance session.
exports.create = async (req, res) => {
  const { date, reason, requestedCheckIn, requestedCheckOut } = req.body;

  if (!date || !DATE_RE.test(date)) {
    return res.status(400).json({ message: 'A valid date (YYYY-MM-DD) is required.' });
  }
  if (date > istDateString()) {
    return res.status(400).json({ message: "Can't regularize a future date." });
  }
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ message: 'A reason is required.' });
  }
  if (!requestedCheckIn || !TIME_RE.test(requestedCheckIn) || !requestedCheckOut || !TIME_RE.test(requestedCheckOut)) {
    return res.status(400).json({ message: 'Requested check-in and check-out times (HH:MM) are required.' });
  }
  if (requestedCheckOut <= requestedCheckIn) {
    return res.status(400).json({ message: 'Check-out must be after check-in.' });
  }

  const existingAttendance = await Attendance.findOne({ employee: req.employee._id, date });
  if (existingAttendance?.sessions.some((s) => s.checkOut)) {
    return res.status(409).json({ message: `${date} already has attendance recorded — nothing to regularize.` });
  }

  const approvedLeave = await Leave.findOne({ employee: req.employee._id, date, status: 'approved' });
  if (approvedLeave) {
    return res.status(409).json({ message: `${date} is an approved leave day and can't be regularized.` });
  }

  const existing = await AttendanceRegularization.findOne({ employee: req.employee._id, date });
  if (existing && existing.status === 'approved') {
    return res.status(409).json({ message: `${date} already has an approved regularization.` });
  }

  const record = await AttendanceRegularization.findOneAndUpdate(
    { employee: req.employee._id, date },
    {
      $set: {
        reason: String(reason).trim(),
        requestedCheckIn,
        requestedCheckOut,
        status: 'pending',
        reviewNote: '',
        reviewedAt: null,
      },
    },
    { upsert: true, new: true },
  );

  res.status(201).json({ request: sanitize(record) });
};

exports.sanitize = sanitize;
