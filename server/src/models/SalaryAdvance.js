const mongoose = require('mongoose');

// An employee's request for cash now, to be recovered from a *future*
// month's payable salary — the classic "advance against next month's pay"
// a daily-wage workforce asks for mid-month. Kept separate from Payout
// (which records money the owner already gave the employee for wages
// already earned) — an advance is the opposite direction: money given
// ahead of being earned, netted out of payable later (see
// salary.controller.js, which deducts an approved advance from the salary
// of the month right after `requestedDate`, regardless of when it's
// actually reviewed).
const salaryAdvanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    amount: { type: Number, required: true, min: 0.01 },
    reason: { type: String, required: true, trim: true },
    requestedDate: { type: String, required: true }, // YYYY-MM-DD, IST — determines the deduction month (requestedDate's month + 1)
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewNote: { type: String, default: '' },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

salaryAdvanceSchema.index({ employee: 1, createdAt: -1 });

module.exports = mongoose.model('SalaryAdvance', salaryAdvanceSchema);
