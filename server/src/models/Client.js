const mongoose = require('mongoose');

// A customer the business works for, with the vendor it's served through
// (e.g. client "Sharma Residence", vendor "Satya Solar"). Tasks are assigned
// against a client (see Task.js / adminTask.controller.js), which is what
// makes this a proper client database instead of free-typed task titles.
const clientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    vendorName: { type: String, required: true, trim: true, maxlength: 120 },
  },
  { timestamps: true },
);

clientSchema.index({ name: 1, vendorName: 1 });

module.exports = mongoose.model('Client', clientSchema);
