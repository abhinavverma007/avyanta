const AuditLog = require('../models/AuditLog');
const Leave = require('../models/Leave');
const Reimbursement = require('../models/Reimbursement');
const SalaryAdvance = require('../models/SalaryAdvance');
const AttendanceRegularization = require('../models/AttendanceRegularization');

const TARGETS = [
  { model: Leave, resourceType: 'Leave', actions: ['leave.approve', 'leave.reject'] },
  { model: Reimbursement, resourceType: 'Reimbursement', actions: ['reimbursement.approve', 'reimbursement.reject'] },
  { model: SalaryAdvance, resourceType: 'SalaryAdvance', actions: ['advance.approve', 'advance.reject'] },
  {
    model: AttendanceRegularization,
    resourceType: 'AttendanceRegularization',
    actions: ['regularization.approve', 'regularization.reject'],
  },
];

// Stamps `reviewedBy` on approved/rejected requests that were reviewed before
// that field existed, using the audit trail (every approve/reject already
// wrote an AuditLog entry with the actor's id/name). Idempotent — only
// touches records that still have no reviewedBy, and only ever copies values
// from the audit log. Dry run unless apply is true.
async function runBackfill({ apply = false } = {}) {
  const results = {};
  for (const { model, resourceType, actions } of TARGETS) {
    const missing = await model
      .find({ status: { $in: ['approved', 'rejected'] }, 'reviewedBy.name': { $exists: false } })
      .select('_id status');
    let matched = 0;
    for (const doc of missing) {
      // Latest review entry wins (be defensive about re-opened requests).
      const entry = await AuditLog.findOne({ resourceType, resourceId: doc._id, action: { $in: actions } })
        .sort({ createdAt: -1 });
      if (!entry) continue;
      matched++;
      if (apply) {
        await model.updateOne(
          { _id: doc._id },
          { $set: { reviewedBy: { id: entry.actorId, name: entry.actorName, actorType: entry.actorType } } },
        );
      }
    }
    results[resourceType] = { reviewedWithoutReviewer: missing.length, [apply ? 'updated' : 'canBeFilled']: matched };
  }
  return results;
}

module.exports = { runBackfill };
