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
    date: { type: String, required: true }, // YYYY-MM-DD, IST calendar day
    employees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true }],
  },
  { timestamps: true },
);

taskSchema.index({ date: 1 });
taskSchema.index({ employees: 1, date: 1 });

module.exports = mongoose.model('Task', taskSchema);
