const mongoose = require('mongoose');

// Backs atomic auto-incrementing IDs (see utils/employeeIdentity.js) — a
// single document per counter name, bumped with $inc so concurrent creates
// never hand out the same sequence number.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', counterSchema);
