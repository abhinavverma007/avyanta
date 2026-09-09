const mongoose = require('mongoose');

const reimbursementSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    category: { type: String, enum: ['petrol', 'food', 'travel', 'other'], required: true },
    amount: { type: Number, required: true, min: 0.01 },
    description: { type: String, required: true, trim: true },
    date: { type: String, required: true }, // YYYY-MM-DD, date the expense was incurred
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewNote: { type: String, default: '' },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

// Matches SalaryAdvance's index — supports both the general Approvals list
// (sorted newest-first) and the per-employee Profile page filter, neither of
// which had any index to use here before.
reimbursementSchema.index({ employee: 1, createdAt: -1 });

module.exports = mongoose.model('Reimbursement', reimbursementSchema);
