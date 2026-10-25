const mongoose = require('mongoose');

// An employee's request for cash now, recovered from their salary — the
// classic advance a daily-wage workforce asks for mid-month. Kept separate
// from Payout (which records money the owner already gave the employee for
// wages already earned) — an advance is the opposite direction: money given
// ahead of being earned, netted out of payable (see salary.controller.js,
// which deducts an approved advance from its `deductMonth` salary,
// regardless of when it's actually reviewed). New advances come out of the
// month they were requested in; see utils/advanceMonth.js for how older
// ones (no `deductMonth`) keep deducting from the month after.
const salaryAdvanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    amount: { type: Number, required: true, min: 0.01 },
    reason: { type: String, required: true, trim: true },
    requestedDate: { type: String, required: true }, // YYYY-MM-DD, IST
    // The salary month this advance is deducted from, 'YYYY-MM'. Set when the advance is
    // requested (its own month). Absent on advances requested before this existed — those
    // keep the old rule, the month after requestedDate (see utils/advanceMonth.js).
    deductMonth: { type: String, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewNote: { type: String, default: '' },
    reviewedAt: { type: Date },
    // Who approved/rejected it — either the owner (Admin) or a delegated
    // Supervisor/Manager (Employee). Absent on records reviewed before this
    // field existed (see scripts/backfillReviewedBy.js).
    override: require('./overrideField'),
    reviewedBy: {
      id: { type: mongoose.Schema.Types.ObjectId },
      name: { type: String },
      actorType: { type: String, enum: ['admin', 'employee'] },
    },
  },
  { timestamps: true },
);

salaryAdvanceSchema.index({ employee: 1, createdAt: -1 });

module.exports = mongoose.model('SalaryAdvance', salaryAdvanceSchema);
