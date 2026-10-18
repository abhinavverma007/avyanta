const Employee = require('../models/Employee');
const { computeMonthlyAttendance } = require('../utils/attendanceStats');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const AttendanceRegularization = require('../models/AttendanceRegularization');
const { istNow, istDateString, istHHMM, istToDate } = require('../utils/istDate');
const { recordAudit } = require('../utils/audit');
const { reviewerStamp } = require('../utils/reviewer');
const { notifyEmployee } = require('../utils/notify');

exports.monthly = async (req, res) => {
  const employee = await Employee.findById(req.params.employeeId);
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });

  const now = istNow();
  const year = parseInt(req.query.year, 10) || now.getUTCFullYear();
  const month = parseInt(req.query.month, 10) || now.getUTCMonth() + 1;

  const data = await computeMonthlyAttendance(employee, year, month, { markRegularized: true });
  res.json({
    ...data,
    employee: {
      id: employee._id.toString(),
      name: employee.name,
      employeeId: employee.employeeId,
      department: employee.department,
    },
  });
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const STATUS_LABEL = { present: 'Present', absent: 'Absent', leave: 'Leave' };

function shiftStartMinutes(shiftStart) {
  const [h, m] = (shiftStart || '09:30').split(':').map(Number);
  return h * 60 + m;
}

// Puts a document back exactly as captured — or removes it if it didn't exist
// before. Used only to undo a half-applied override.
async function restoreDoc(Model, snapshot, filter) {
  if (snapshot) await Model.replaceOne({ _id: snapshot._id }, snapshot, { upsert: true });
  else await Model.deleteOne(filter);
}

// Owner-only: sets one employee's attendance for one past-or-today date to
// Present (with in/out times), Absent, or Leave.
//
// Everything that reads attendance (salary, calendars, leave quota) derives
// from three collections — Attendance, Leave, AttendanceRegularization — so
// the override has to leave all three telling the same story:
//  - Present  -> an Attendance record (a real punch always wins over a leave
//               record, but an approved/pending leave would still eat leave
//               quota, so it is rejected); a pending fix request is moot.
//  - Absent   -> no Attendance record and no live leave.
//  - Leave    -> no Attendance record, an approved Leave record.
// A pending fix request for that day is always closed as superseded, so a
// Supervisor approving it later can't silently overwrite the owner's call.
// All validation happens before the first write, and if a later write fails
// the earlier ones are put back.
exports.overrideDay = async (req, res) => {
  if (!req.admin) return res.status(403).json({ message: 'Only the owner can override attendance.' });

  const { employeeId, date } = req.params;
  const { status, checkIn, checkOut } = req.body;
  const rawPercent = req.body.percent;
  const note = String(req.body.reason || '').trim();

  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
    return res.status(400).json({ message: 'date must be in YYYY-MM-DD format.' });
  }
  if (!STATUS_LABEL[status]) {
    return res.status(400).json({ message: 'status must be "present", "absent" or "leave".' });
  }

  const employee = await Employee.findById(employeeId);
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });

  const today = istDateString();
  if (date > today) return res.status(400).json({ message: "Attendance can't be changed for a future date." });
  if (employee.joinDate && date < employee.joinDate) {
    return res.status(400).json({ message: `${employee.name} joined on ${employee.joinDate} — there's no attendance before that.` });
  }

  // Share of the day that counts, present days only. Omitted or 100 = a full
  // day (stored as no percent at all, same as every record before this existed).
  let percent;
  if (status === 'present' && rawPercent !== undefined && rawPercent !== null && rawPercent !== '') {
    const n = Number(rawPercent);
    if (!Number.isFinite(n) || n < 1 || n > 100) {
      return res.status(400).json({ message: 'percent must be a number from 1 to 100.' });
    }
    percent = Math.round(n * 100) / 100;
    if (percent >= 100) percent = undefined;
  }

  let inAt;
  let outAt;
  if (status === 'present') {
    if (!TIME_RE.test(checkIn || '') || !TIME_RE.test(checkOut || '')) {
      return res.status(400).json({ message: 'Check-in and check-out times (HH:MM) are required.' });
    }
    if (checkOut <= checkIn) return res.status(400).json({ message: 'Check-out must be after check-in.' });
    if (date === today && checkOut > istHHMM(new Date())) {
      return res.status(400).json({ message: "Today's times can't be later than the current time." });
    }
    inAt = istToDate(date, checkIn);
    outAt = istToDate(date, checkOut);
  }

  const [attendance, leave, regularization] = await Promise.all([
    Attendance.findOne({ employee: employee._id, date }),
    Leave.findOne({ employee: employee._id, date }),
    AttendanceRegularization.findOne({ employee: employee._id, date }),
  ]);

  const current = attendance ? 'present' : leave?.status === 'approved' ? 'leave' : leave?.status === 'pending' ? 'pending' : 'absent';
  if (status === 'absent' && current === 'absent') return res.status(409).json({ message: `${date} is already marked absent.` });
  if (status === 'leave' && current === 'leave') return res.status(409).json({ message: `${date} is already marked as leave.` });
  if (
    status === 'present' && attendance && attendance.sessions.length === 1 &&
    attendance.sessions[0].checkOut &&
    attendance.sessions[0].checkIn.getTime() === inAt.getTime() &&
    attendance.sessions[0].checkOut.getTime() === outAt.getTime() &&
    (attendance.percent ?? 100) === (percent ?? 100)
  ) {
    return res.status(409).json({ message: `${date} already has exactly these times.` });
  }

  const attendanceSnap = attendance ? attendance.toObject() : null;
  const leaveSnap = leave ? leave.toObject() : null;
  const regSnap = regularization ? regularization.toObject() : null;
  const now = new Date();
  const stamp = reviewerStamp(req);
  const attendanceFilter = { employee: employee._id, date };
  const leaveFilter = { employee: employee._id, date };

  let leaveRejected = false;
  let regularizationClosed = false;

  try {
    if (status === 'present') {
      const [h, m] = checkIn.split(':').map(Number);
      await Attendance.findOneAndUpdate(
        attendanceFilter,
        {
          $set: {
            status: 'present',
            sessions: [{ checkIn: inAt, checkOut: outAt }],
            lateBy: Math.max(0, h * 60 + m - shiftStartMinutes(employee.shiftStart)),
            override: { at: now, by: { id: req.admin._id, name: req.admin.name }, previousStatus: current, note },
            ...(percent ? { percent } : {}),
          },
          ...(percent ? {} : { $unset: { percent: 1 } }),
        },
        { upsert: true },
      );
    } else {
      await Attendance.deleteOne(attendanceFilter);
    }

    if (status === 'leave') {
      await Leave.findOneAndUpdate(
        leaveFilter,
        {
          $set: {
            reason: note || 'Marked by owner',
            status: 'approved',
            reviewNote: 'Set by owner',
            reviewedAt: now,
            reviewedBy: stamp,
            setByOwner: true,
          },
          $unset: { override: 1 },
        },
        { upsert: true },
      );
    } else if (leave && (leave.status === 'approved' || leave.status === 'pending')) {
      // No longer a leave day — reject it so it stops counting against the
      // employee's monthly leave quota.
      await Leave.updateOne(
        { _id: leave._id },
        { $set: { status: 'rejected', reviewNote: 'Attendance set by owner', reviewedAt: now, reviewedBy: stamp }, $unset: { override: 1, setByOwner: 1 } },
      );
      leaveRejected = true;
    }

    if (regularization && regularization.status === 'pending') {
      await AttendanceRegularization.updateOne(
        { _id: regularization._id },
        { $set: { status: 'rejected', reviewNote: 'Superseded — attendance set by owner', reviewedAt: now, reviewedBy: stamp }, $unset: { override: 1 } },
      );
      regularizationClosed = true;
    }
  } catch (err) {
    await Promise.allSettled([
      restoreDoc(Attendance, attendanceSnap, attendanceFilter),
      restoreDoc(Leave, leaveSnap, leaveFilter),
      restoreDoc(AttendanceRegularization, regSnap, { employee: employee._id, date }),
    ]);
    throw err;
  }

  await recordAudit(req, {
    action: 'attendance.override',
    resourceType: 'Attendance',
    resourceId: attendance?._id,
    summary: `Set ${employee.name}'s attendance for ${date} from ${current} to ${status}`,
    metadata: {
      date,
      from: current,
      to: status,
      reason: note,
      checkIn: status === 'present' ? checkIn : undefined,
      checkOut: status === 'present' ? checkOut : undefined,
      percent: status === 'present' ? percent ?? 100 : undefined,
      previousPercent: attendanceSnap ? attendanceSnap.percent ?? 100 : undefined,
      // What was there before, so a wrongly-set day can be reconstructed.
      previousSessions: attendanceSnap ? attendanceSnap.sessions : [],
      leaveRejected,
      regularizationClosed,
    },
  });

  // Not awaited — see the note in notify.js.
  notifyEmployee(employee._id, {
    type: 'attendance.overridden',
    title: `Your attendance for ${date} was set to ${STATUS_LABEL[status]}${percent ? ` (${percent}%)` : ''} by ${req.admin.name}`,
    body: note,
    link: '/attendance',
  });

  res.json({ date, status, previousStatus: current, percent: percent ?? 100 });
};
