const mongoose = require('mongoose');

// One document per assignment-date. A multi-day assignment from the
// superadmin becomes several of these (one per date, see adminTask
// controller). Several employees can share the same task/site/date — these
// are labourers, and more than one of them often works the same site.
const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    site: { type: String, default: '' },
    siteLocation: {
      type: new mongoose.Schema({ lat: Number, lng: Number }, { _id: false }),
      default: undefined,
    },
    date: { type: String, required: true }, // YYYY-MM-DD, IST calendar day
    employees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true }],
    status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
    // Set together whenever status becomes 'completed' (cleared otherwise).
    // completedBy is an assigned employee, or null when the owner set the
    // status directly instead.
    completedAt: { type: Date, default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    // An employee's way of telling the owner something without either side
    // needing a full chat thread — append-only (no edit/delete), same
    // "just log it" philosophy as the audit log. authorName is denormalized
    // so a note still reads correctly even if that employee is later
    // renamed/deactivated.
    notes: [
      {
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
        authorName: { type: String, required: true },
        text: { type: String, required: true, trim: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

taskSchema.index({ date: 1 });
taskSchema.index({ employees: 1, date: 1 });
// Supports the owner's status filter (superadmin-tasks list) — without
// this, filtering by status on a large collection falls back to a full
// collection scan since nothing else indexes that field.
taskSchema.index({ status: 1, date: -1 });

module.exports = mongoose.model('Task', taskSchema);
