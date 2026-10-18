const AttendanceRegularization = require('../models/AttendanceRegularization');
const Attendance = require('../models/Attendance');
const { sanitize } = require('./attendanceRegularization.controller');
const { istToDate, istHHMM } = require('../utils/istDate');
const { recordAudit } = require('../utils/audit');
const { reviewerStamp } = require('../utils/reviewer');
const { rejectSelfReview } = require('../utils/reviewGuard');
const { notifyEmployee } = require('../utils/notify');
const { checkOverridable, flipDecision, rollbackDecision, notifyOverride } = require('../utils/reviewOverride');

function shiftStartMinutes(shiftStart) {
  const [h, m] = (shiftStart || '09:30').split(':').map(Number);
  return h * 60 + m;
}

function withEmployee(request) {
  return {
    ...sanitize(request),
    employee: request.employee
      ? {
          id: request.employee._id.toString(),
          name: request.employee.name,
          employeeId: request.employee.employeeId,
          department: request.employee.department,
        }
      : null,
  };
}

exports.list = async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  const requests = await AttendanceRegularization.find(filter)
    .populate('employee', 'name employeeId department shiftStart')
    .sort({ createdAt: -1 });

  res.json({ requests: requests.map(withEmployee) });
};

exports.review = (status) => async (req, res) => {
  const request = await AttendanceRegularization.findById(req.params.id).populate('employee', 'name employeeId department shiftStart');
  if (!request) return res.status(404).json({ message: 'Regularization request not found.' });
  if (request.status !== 'pending') {
    return res.status(409).json({ message: `Request already ${request.status}.` });
  }
  if (rejectSelfReview(req, res, request.employee._id)) return;

  if (status === 'approved') {
    const checkIn = istToDate(request.date, request.requestedCheckIn);
    const checkOut = istToDate(request.date, request.requestedCheckOut);
    const [h, m] = request.requestedCheckIn.split(':').map(Number);
    const lateBy = Math.max(0, h * 60 + m - shiftStartMinutes(request.employee?.shiftStart));

    await Attendance.findOneAndUpdate(
      { employee: request.employee._id, date: request.date },
      { $set: { status: 'present', sessions: [{ checkIn, checkOut }], lateBy } },
      { upsert: true },
    );
  }

  request.status = status;
  request.reviewNote = req.body.reviewNote || '';
  request.reviewedAt = new Date();
  request.reviewedBy = reviewerStamp(req);
  await request.save();

  await recordAudit(req, {
    action: status === 'approved' ? 'regularization.approve' : 'regularization.reject',
    resourceType: 'AttendanceRegularization',
    resourceId: request._id,
    summary: `${status === 'approved' ? 'Approved' : 'Rejected'} ${request.employee?.name}'s regularization for ${request.date}`,
  });

  // Not awaited — see the note in notify.js.
  notifyEmployee(request.employee._id, {
    type: status === 'approved' ? 'regularization.approved' : 'regularization.rejected',
    title: `Your attendance fix for ${request.date} was ${status}`,
    body: request.reviewNote || '',
    link: '/requests',
  });

  res.json({ request: withEmployee(request) });
};

// Owner flips an attendance-fix decision a delegated Supervisor/Manager made.
// Unlike the other request types this one *writes* on approval (it creates
// the day's Attendance record), so an override has to apply or undo that
// write too — otherwise status and attendance would disagree.
exports.override = async (req, res) => {
  const targetStatus = req.body.status;
  const request = await AttendanceRegularization.findById(req.params.id).populate('employee', 'name employeeId department shiftStart');
  if (!request) return res.status(404).json({ message: 'Regularization request not found.' });

  const problem = checkOverridable(req, request, targetStatus);
  if (problem) return res.status(problem[0]).json({ message: problem[1] });

  const checkIn = istToDate(request.date, request.requestedCheckIn);
  const checkOut = istToDate(request.date, request.requestedCheckOut);
  const sameSession = (s) => s.checkOut && s.checkIn.getTime() === checkIn.getTime() && s.checkOut.getTime() === checkOut.getTime();
  const existing = await Attendance.findOne({ employee: request.employee._id, date: request.date });

  // Checked before anything is written, so a refusal leaves everything as it was.
  if (targetStatus === 'approved') {
    // Same guard the employee hits when applying — never overwrite a real punch.
    if (existing?.sessions.some((s) => s.checkOut)) {
      return res.status(409).json({ message: `${request.date} already has attendance recorded — nothing to regularize.` });
    }
  } else if (!existing || !existing.sessions.some(sameSession)) {
    return res.status(409).json({
      message: `Attendance for ${request.date} was changed after this fix was approved, so it can't be undone automatically.`,
    });
  }

  const updated = await flipDecision(AttendanceRegularization, req, request, targetStatus, req.body.reviewNote);
  if (!updated) return res.status(409).json({ message: 'This request was changed by someone else — refresh and try again.' });
  updated.employee = request.employee;

  try {
    if (targetStatus === 'approved') {
      const [h, m] = request.requestedCheckIn.split(':').map(Number);
      const lateBy = Math.max(0, h * 60 + m - shiftStartMinutes(request.employee?.shiftStart));
      await Attendance.findOneAndUpdate(
        { employee: request.employee._id, date: request.date },
        { $set: { status: 'present', sessions: [{ checkIn, checkOut }], lateBy } },
        { upsert: true },
      );
    } else {
      // Take out only the session this request created; if that leaves the
      // day empty it was never a real punch day, so the record goes with it.
      const after = await Attendance.findOneAndUpdate(
        { _id: existing._id },
        { $pull: { sessions: { checkIn, checkOut } } },
        { new: true },
      );
      if (after && after.sessions.length === 0) {
        await Attendance.deleteOne({ _id: after._id, sessions: { $size: 0 } });
      } else if (after) {
        const [h, m] = istHHMM(after.sessions[0].checkIn).split(':').map(Number);
        after.lateBy = Math.max(0, h * 60 + m - shiftStartMinutes(request.employee?.shiftStart));
        await after.save();
      }
    }
  } catch (err) {
    await rollbackDecision(AttendanceRegularization, request);
    throw err;
  }

  await recordAudit(req, {
    action: 'regularization.override',
    resourceType: 'AttendanceRegularization',
    resourceId: request._id,
    summary: `Overrode ${request.reviewedBy.name}'s ${request.status} decision on ${request.employee.name}'s regularization for ${request.date} — now ${targetStatus}`,
    metadata: { from: request.status, to: targetStatus, previousReviewer: request.reviewedBy.name },
  });

  notifyOverride({
    actorName: req.admin.name,
    kind: 'regularization',
    section: 'regularization',
    label: `attendance fix for ${request.date}`,
    previous: request,
    doc: updated,
    employee: request.employee,
  });

  res.json({ request: withEmployee(updated) });
};
