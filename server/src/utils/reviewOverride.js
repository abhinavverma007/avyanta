const { reviewerStamp } = require('./reviewer');
const { notifyEmployee } = require('./notify');

// Owner-only "override": flips an already-made approve/reject decision that
// a delegated Supervisor/Manager took. Everything that *reads* a request's
// status (salary, attendance calendar, leave quota, notifications) already
// derives from `status`, so flipping it atomically is what makes those
// follow — the only extra work is the one place a decision writes elsewhere
// (attendance regularization -> Attendance), handled in that controller.

// Rules, in one place so all four request types agree:
//  - owner (req.admin) only — the /team mount shares these routers, so this
//    is enforced here, not just by mounting;
//  - the request must already be decided (a pending one is approved/rejected
//    the normal way);
//  - only a delegate's decision can be overridden. The owner's own decision
//    is final, and a request with no recorded reviewer (reviewed before
//    `reviewedBy` existed) can't be attributed, so it is left alone;
//  - it must flip to the *other* status, never a no-op.
function checkOverridable(req, doc, targetStatus) {
  if (!req.admin) return [403, 'Only the owner can override a decision.'];
  if (targetStatus !== 'approved' && targetStatus !== 'rejected') {
    return [400, 'status must be "approved" or "rejected".'];
  }
  if (doc.status === 'pending') return [409, 'This request has not been reviewed yet — approve or reject it instead.'];
  if (doc.reviewedBy?.actorType !== 'employee') {
    return [409, doc.reviewedBy?.actorType === 'admin'
      ? 'This decision was made by the owner and can\'t be overridden.'
      : 'The reviewer of this request is unknown, so it can\'t be overridden.'];
  }
  if (doc.status === targetStatus) return [409, `Request is already ${doc.status}.`];
  return null;
}

// Atomically flips the decision, guarded on the exact state we validated so
// two concurrent overrides (or an override racing a re-submission, which
// resets the request to pending) can never both apply. Returns the updated
// doc, or null if the request changed underneath us.
async function flipDecision(Model, req, previous, targetStatus, reviewNote) {
  const now = new Date();
  return Model.findOneAndUpdate(
    { _id: previous._id, status: previous.status, 'reviewedBy.actorType': 'employee' },
    {
      $set: {
        status: targetStatus,
        reviewNote: reviewNote || '',
        reviewedAt: now,
        reviewedBy: reviewerStamp(req),
        override: {
          at: now,
          previousStatus: previous.status,
          previousReviewNote: previous.reviewNote || '',
          previousReviewedAt: previous.reviewedAt,
          previousReviewedBy: {
            id: previous.reviewedBy.id,
            name: previous.reviewedBy.name,
            actorType: previous.reviewedBy.actorType,
          },
        },
      },
    },
    { new: true },
  );
}

// Puts a request back exactly as it was before flipDecision — used only if a
// side effect after the flip fails, so a half-applied override never sticks.
// (An overridable request never carries an `override` of its own: overriding
// makes the owner the reviewer, which makes it non-overridable, and a
// re-submission clears it — so restoring means removing it.)
async function rollbackDecision(Model, previous) {
  await Model.updateOne(
    { _id: previous._id },
    {
      $set: {
        status: previous.status,
        reviewNote: previous.reviewNote || '',
        reviewedAt: previous.reviewedAt,
        reviewedBy: {
          id: previous.reviewedBy.id,
          name: previous.reviewedBy.name,
          actorType: previous.reviewedBy.actorType,
        },
      },
      $unset: { override: 1 },
    },
  );
}

// Tells the employee their request's outcome changed, and tells the
// Supervisor/Manager whose decision it was. Reuses the employee-facing
// `<kind>.approved|rejected` types so anything keyed on them keeps working.
// Fire-and-forget like every other notification (see notify.js).
function notifyOverride({ kind, section, label, previous, doc, employee }) {
  const reviewNote = doc.reviewNote || '';
  notifyEmployee(employee._id, {
    type: `${kind}.${doc.status}`,
    title: `Your ${label} was changed to ${doc.status} by the owner`,
    body: reviewNote,
    link: '/requests',
  });
  notifyEmployee(previous.reviewedBy.id, {
    type: `${kind}.overridden`,
    title: `The owner changed your decision on ${employee.name}'s ${label} to ${doc.status}`,
    body: reviewNote,
    link: `/superadmin/approvals?section=${section}&employee=${employee.employeeId}`,
  });
}

function sanitizeOverride(o) {
  if (!o || !o.at) return null;
  return {
    at: o.at,
    previousStatus: o.previousStatus,
    previousReviewedBy: o.previousReviewedBy && o.previousReviewedBy.name
      ? { id: String(o.previousReviewedBy.id), name: o.previousReviewedBy.name, actorType: o.previousReviewedBy.actorType }
      : null,
  };
}

module.exports = { checkOverridable, flipDecision, rollbackDecision, notifyOverride, sanitizeOverride };
