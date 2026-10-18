const mongoose = require('mongoose');

// The end-of-day work report a labourer fills in after punching out — the
// written replacement for a daily stand-up call. One per employee per day
// (submitting again the same day edits it). Mostly tap-to-select values so it
// takes about a minute on a phone; the keys below are stable identifiers, the
// wording shown to people lives in the client's translation files.
const WORK_TYPES = [
  'structure', 'panel_fitting', 'wiring', 'inverter', 'earthing', 'meter',
  'testing', 'survey', 'material_handling', 'maintenance', 'travel', 'other',
];
const PROBLEMS = [
  'none', 'material_shortage', 'tools_missing', 'weather', 'client_unavailable',
  'power_access', 'waiting_vendor', 'faulty_equipment',
];

const dailyReportSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD, IST calendar day

    // The jobs the employee was assigned that day — linked automatically (the
    // worker isn't asked), so a report still shows up under the right client's
    // servicing history. title/site are copied so it reads correctly if the task
    // or client is later changed or deleted.
    jobs: [
      {
        task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
        title: { type: String, default: '' },
        site: { type: String, default: '' },
        _id: false,
      },
    ],

    workTypes: [{ type: String, enum: WORK_TYPES }],

    problems: [{ type: String, enum: PROBLEMS }], // ['none'] when there was no problem
    problemNote: { type: String, default: '', trim: true, maxlength: 500 },
    safetyIncident: { type: Boolean, required: true },
    safetyNote: { type: String, default: '', trim: true, maxlength: 500 },

    // Anything else the worker wants the owner to know — free text, optional.
    messageToOwner: { type: String, default: '', trim: true, maxlength: 1000 },

    // From that day's attendance, captured when the report is submitted.
    hoursWorked: { type: Number },
    punchedInAt: { type: Date },
    punchedOutAt: { type: Date },

    // A problem or a safety incident was reported — what the owner scans for.
    flagged: { type: Boolean, default: false },
  },
  { timestamps: true },
);

dailyReportSchema.index({ employee: 1, date: 1 }, { unique: true });
dailyReportSchema.index({ date: -1 });
dailyReportSchema.index({ flagged: 1, date: -1 });
dailyReportSchema.index({ 'jobs.task': 1 });

module.exports = mongoose.model('DailyReport', dailyReportSchema);
module.exports.WORK_TYPES = WORK_TYPES;
module.exports.PROBLEMS = PROBLEMS;
