const mongoose = require('mongoose');

// One entry per punch-in/punch-out cycle, so a day can have several
// (e.g. lunch break) — the day's totals are derived from this list.
const sessionSchema = new mongoose.Schema(
  {
    checkIn: { type: Date, required: true },
    checkOut: { type: Date },
  },
  { _id: false },
);

// A stored Attendance document only ever represents a day the employee
// actually punched in — absence, leave and future days are all derived,
// never written here (leave lives in its own Leave collection).
const attendanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD, IST calendar day
    status: { type: String, enum: ['present'], default: 'present' },
    sessions: { type: [sessionSchema], default: [] },
    lateBy: { type: Number }, // minutes, measured against the first punch-in of the day
  },
  { timestamps: true },
);

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
