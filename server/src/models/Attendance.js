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
    // Share of the day that counts as worked, 1-99 — only ever set by the owner
    // (a half day is 50). Absent means a full day, so every existing record is unchanged.
    percent: { type: Number, min: 1, max: 100 },
    // Present only when the owner set this day's attendance by hand (see
    // adminAttendance.controller.js overrideDay) rather than it coming from
    // a real punch or an approved regularization. Absent on every other record.
    override: {
      at: { type: Date },
      by: { id: { type: mongoose.Schema.Types.ObjectId }, name: { type: String } },
      previousStatus: { type: String, enum: ['present', 'absent', 'leave', 'pending'] },
      note: { type: String, default: '' },
    },
  },
  { timestamps: true },
);

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
