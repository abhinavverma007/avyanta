const Leave = require('../models/Leave');
const Attendance = require('../models/Attendance');
const { sanitize } = require('./leave.controller');
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

function withEmployee(leave) {
  return {
    ...sanitize(leave),
    employee: leave.employee
      ? {
          id: leave.employee._id.toString(),
          name: leave.employee.name,
          employeeId: leave.employee.employeeId,
          department: leave.employee.department,
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

  const leaves = await Leave.find(filter)
    .populate('employee', 'name employeeId department')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ leaves: leaves.map(withEmployee) });
};

exports.review = (status) => async (req, res) => {
  const leave = await Leave.findById(req.params.id).populate('employee', 'name employeeId department');
  if (!leave) return res.status(404).json({ message: 'Leave request not found.' });
  if (leave.status !== 'pending') {
    return res.status(409).json({ message: `Leave request already ${leave.status}.` });
  }
  if (rejectSelfReview(req, res, leave.employee._id)) return;

  leave.status = status;
  leave.reviewNote = req.body.reviewNote || '';
  leave.reviewedAt = new Date();
  leave.reviewedBy = reviewerStamp(req);
  await leave.save();

  await recordAudit(req, {
    action: status === 'approved' ? 'leave.approve' : 'leave.reject',
    resourceType: 'Leave',
    resourceId: leave._id,
    summary: `${status === 'approved' ? 'Approved' : 'Rejected'} ${leave.employee?.name}'s leave for ${leave.date}`,
  });

  // Not awaited — see the note in notify.js.
  notifyEmployee(leave.employee._id, {
    type: status === 'approved' ? 'leave.approved' : 'leave.rejected',
    title: `Your leave for ${leave.date} was ${status}`,
    body: leave.reviewNote || '',
    link: '/requests',
  });

  res.json({ leave: withEmployee(leave) });
};

// Owner flips a leave decision a delegated Supervisor/Manager made. Salary,
// the attendance calendar and the monthly leave quota all derive from
// `status`, so flipping it is enough — nothing else is stored for a leave.
exports.override = async (req, res) => {
  const targetStatus = req.body.status;
  const leave = await Leave.findById(req.params.id).populate('employee', 'name employeeId department');
  if (!leave) return res.status(404).json({ message: 'Leave request not found.' });

  const problem = checkOverridable(req, leave, targetStatus);
  if (problem) return res.status(problem[0]).json({ message: problem[1] });

  // Same guard the employee hits when applying: a day they actually punched
  // in can't also be a leave day.
  if (targetStatus === 'approved') {
    const punched = await Attendance.findOne({ employee: leave.employee._id, date: leave.date });
    if (punched && punched.sessions.length > 0) {
      return res.status(409).json({ message: `${leave.date} already has attendance recorded and can't be marked as leave.` });
    }
  }

  const updated = await flipDecision(Leave, req, leave, targetStatus, req.body.reviewNote);
  if (!updated) return res.status(409).json({ message: 'This request was changed by someone else — refresh and try again.' });
  updated.employee = leave.employee;

  await recordAudit(req, {
    action: 'leave.override',
    resourceType: 'Leave',
    resourceId: leave._id,
    summary: `Overrode ${leave.reviewedBy.name}'s ${leave.status} decision on ${leave.employee.name}'s leave for ${leave.date} — now ${targetStatus}`,
    metadata: { from: leave.status, to: targetStatus, previousReviewer: leave.reviewedBy.name },
  });

  notifyOverride({
    actorName: req.admin.name,
    kind: 'leave',
    section: 'leave',
    label: `leave for ${leave.date}`,
    previous: leave,
    doc: updated,
    employee: leave.employee,
  });

  res.json({ leave: withEmployee(updated) });
};
