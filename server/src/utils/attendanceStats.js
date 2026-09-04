const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const { istHHMM, istDateString } = require('./istDate');

// Reduces a day's list of punch sessions down to the figures everything else
// cares about: when they first arrived, when they last left, how many hours
// they actually worked (sum of each closed session, so breaks aren't paid),
// and whether they're currently clocked in.
function summarizeSessions(sessions = []) {
  const completed = sessions.filter((s) => s.checkOut);
  const workHoursMs = completed.reduce((sum, s) => sum + (s.checkOut.getTime() - s.checkIn.getTime()), 0);
  const workHours = Math.round((workHoursMs / 3600000) * 100) / 100;

  const first = sessions[0];
  const last = sessions[sessions.length - 1];
  const stillClockedIn = !!last && !last.checkOut;

  return {
    firstPunchIn: first ? first.checkIn : undefined,
    lastPunchOut: last && !stillClockedIn ? last.checkOut : undefined,
    lastPunchAt: last ? (last.checkOut || last.checkIn) : undefined,
    workHours,
    hasCompletedSession: completed.length > 0,
    punchState: stillClockedIn ? 'in' : 'out',
  };
}

function toDayAttendance(record) {
  const { firstPunchIn, lastPunchOut, workHours, hasCompletedSession } = summarizeSessions(record.sessions);
  return {
    date: record.date,
    status: 'present',
    checkIn: firstPunchIn ? istHHMM(firstPunchIn) : undefined, // first punch-in of the day
    checkOut: lastPunchOut ? istHHMM(lastPunchOut) : undefined, // last punch-out of the day
    workHours: hasCompletedSession ? workHours : undefined, // total hours across all sessions that day
    lateBy: record.lateBy,
  };
}

// Shared by an employee's own /attendance/monthly view and the admin salary
// calculator, so both agree on what counts as present/absent/leave/future.
// No weekends or holidays — every day is a working day until it's in the
// future. A real punch always wins over a leave record for the same date
// (e.g. they ended up coming in after all); a leave booked for a date that
// hasn't happened yet still shows as 'leave', not 'future'.
async function computeMonthlyAttendance(employee, year, month) {
  const pad = (n) => String(n).padStart(2, '0');
  const daysInMonth = new Date(year, month, 0).getDate();
  const start = `${year}-${pad(month)}-01`;
  const end = `${year}-${pad(month)}-${pad(daysInMonth)}`;

  const [attendanceRecords, leaveRecords] = await Promise.all([
    Attendance.find({ employee: employee._id, date: { $gte: start, $lte: end } }),
    Leave.find({ employee: employee._id, date: { $gte: start, $lte: end } }),
  ]);
  const byDate = new Map(attendanceRecords.map((r) => [r.date, r]));
  const leaveByDate = new Map(leaveRecords.map((r) => [r.date, r]));

  const todayStr = istDateString();
  const joinDate = employee.joinDate;

  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${pad(month)}-${pad(d)}`;

    const rec = byDate.get(dateStr);
    if (rec) {
      days.push(toDayAttendance(rec));
      continue;
    }

    const leave = leaveByDate.get(dateStr);
    if (leave) {
      days.push({ date: dateStr, status: 'leave', reason: leave.reason });
      continue;
    }

    if ((joinDate && dateStr < joinDate) || dateStr > todayStr) {
      days.push({ date: dateStr, status: 'future' });
      continue;
    }

    days.push({ date: dateStr, status: 'absent' });
  }

  const workingDays = days.filter((d) => d.status !== 'future');
  return {
    month,
    year,
    days,
    presentDays: workingDays.filter((d) => d.status === 'present').length,
    absentDays: workingDays.filter((d) => d.status === 'absent').length,
    leaveDays: workingDays.filter((d) => d.status === 'leave').length,
    totalWorkingDays: workingDays.length,
  };
}

module.exports = { computeMonthlyAttendance, toDayAttendance, summarizeSessions };
