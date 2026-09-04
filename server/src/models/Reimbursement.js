const mongoose = require('mongoose');

const reimbursementSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    category: { type: String, enum: ['petrol', 'food', 'travel', 'other'], required: true },
    amount: { type: Number, required: true, min: 0.01 },
    description: { type: String, default: '' },
    date: { type: String, required: true }, // YYYY-MM-DD, date the expense was incurred
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewNote: { type: String, default: '' },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Reimbursement', reimbursementSchema);
