const mongoose = require('mongoose');

// One document per calendar day (IST) that the end-of-day check has already been run for — so
// a day is only ever processed once, even if the server restarts or two copies of it run.
// _id is the date, 'YYYY-MM-DD'.
const dayCloseSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  processedAt: { type: Date, required: true },
  voidedCount: { type: Number, default: 0 },
  employeeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
});

module.exports = mongoose.model('DayClose', dayCloseSchema);
