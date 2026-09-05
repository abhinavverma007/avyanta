const Attendance = require('../models/Attendance');
const { istNow, istDateString, istMinutesSinceMidnight, istHHMM } = require('../utils/istDate');
const { computeMonthlyAttendance, toDayAttendance, summarizeSessions } = require('../utils/attendanceStats');

function shiftStartMinutes(shiftStart) {
  const [h, m] = (shiftStart || '09:30').split(':').map(Number);
  return h * 60 + m;
}

// Each call toggles: open a new session if the last one is closed (or this is
// the first punch of the day), otherwise close the open one. So a day can
// have several in/out cycles — e.g. lunch break — with no cap.
exports.punch = async (req, res) => {
  const employee = req.employee;
  const today = istDateString();
  const now = new Date();

  let record = await Attendance.findOne({ employee: employee._id, date: today });

  if (!record) {
    const lateBy = Math.max(0, istMinutesSinceMidnight() - shiftStartMinutes(employee.shiftStart));
    record = await Attendance.create({
      employee: employee._id,
      date: today,
      status: 'present',
      sessions: [{ checkIn: now }],
      lateBy,
    });
    return res.status(201).json({ type: 'in', lastPunchAt: istHHMM(now), record: toDayAttendance(record) });
  }

  const last = record.sessions[record.sessions.length - 1];
  if (!last || last.checkOut) {
    record.sessions.push({ checkIn: now });
    await record.save();
    return res.status(201).json({ type: 'in', lastPunchAt: istHHMM(now), record: toDayAttendance(record) });
  }

  last.checkOut = now;
  await record.save();
  return res.json({ type: 'out', lastPunchAt: istHHMM(now), record: toDayAttendance(record) });
};

exports.today = async (req, res) => {
  const today = istDateString();
  const record = await Attendance.findOne({ employee: req.employee._id, date: today });

  if (!record) {
    return res.json({ date: today, status: 'absent', punchState: 'out' });
  }

  const { punchState, lastPunchAt } = summarizeSessions(record.sessions);
  res.json({
    ...toDayAttendance(record),
    punchState,
    lastPunchAt: lastPunchAt ? istHHMM(lastPunchAt) : undefined,
  });
};

// For the "I punched in by mistake" case — wipes today's attendance record
// entirely, back to exactly the state as if no punch had happened today.
// Deliberately hardcoded to today's date server-side (never a client-passed
// date), so this can never be used to erase a past day's attendance.
exports.unmarkToday = async (req, res) => {
  const today = istDateString();
  await Attendance.deleteOne({ employee: req.employee._id, date: today });
  res.json({ date: today, status: 'absent', punchState: 'out' });
};

exports.monthly = async (req, res) => {
  const now = istNow();
  const year = parseInt(req.query.year, 10) || now.getUTCFullYear();
  const month = parseInt(req.query.month, 10) || now.getUTCMonth() + 1;

  const data = await computeMonthlyAttendance(req.employee, year, month);
  res.json(data);
};
