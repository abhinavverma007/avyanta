const mongoose = require('mongoose');

// An employee's request to correct a day with no valid attendance (usually
// they forgot to punch). Kept separate from Attendance — approving one
// writes a real Attendance session (see adminAttendanceRegularization.controller.js),
// but the request itself, its reason and its review trail live here.
const attendanceRegularizationSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD, IST calendar day being corrected
    reason: { type: String, required: true, trim: true },
    requestedCheckIn: { type: String, required: true }, // HH:MM, IST
    requestedCheckOut: { type: String, required: true }, // HH:MM, IST
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewNote: { type: String, default: '' },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

attendanceRegularizationSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceRegularization', attendanceRegularizationSchema);
