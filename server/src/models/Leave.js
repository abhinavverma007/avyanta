const mongoose = require('mongoose');

// One document per employee per leave date. Kept separate from Attendance —
// a leave day never has punch sessions, so it doesn't belong mixed into the
// same collection as real check-in/check-out records.
// Requests start 'pending' and only count as an actual leave day once the
// superadmin approves them (see adminLeave.controller.js).
const leaveSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD, IST calendar day
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewNote: { type: String, default: '' },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

leaveSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Leave', leaveSchema);
