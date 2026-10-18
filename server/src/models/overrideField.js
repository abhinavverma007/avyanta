// Shared `override` sub-document for every approvable request (Leave,
// Reimbursement, SalaryAdvance, AttendanceRegularization). Only ever written
// when the owner flips a decision a delegated Supervisor/Manager made — it
// keeps what that decision *was*, since status/reviewedBy/reviewedAt/
// reviewNote on the request itself now describe the owner's decision.
// Absent on every request that was never overridden (i.e. all existing data).
module.exports = {
  at: { type: Date },
  previousStatus: { type: String, enum: ['approved', 'rejected'] },
  previousReviewNote: { type: String, default: '' },
  previousReviewedAt: { type: Date },
  previousReviewedBy: {
    id: { type: require('mongoose').Schema.Types.ObjectId },
    name: { type: String },
    actorType: { type: String, enum: ['admin', 'employee'] },
  },
};
