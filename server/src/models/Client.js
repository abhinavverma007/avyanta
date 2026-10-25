const mongoose = require('mongoose');

// A customer the business works for, with the vendor it's served through
// (e.g. client "Sharma Residence", vendor "Satya Solar"). Tasks are assigned
// against a client (see Task.js / adminTask.controller.js), which is what
// makes this a proper client database instead of free-typed task titles.
const clientSchema = new mongoose.Schema(
  {
    // CD-0001, CD-0002, … assigned once and never changed (see utils/clientCode.js). It is how
    // a client is identified in the Assign Task dropdown, together with the vendor.
    clientCode: { type: String, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    vendorName: { type: String, required: true, trim: true, maxlength: 120 },

    // Everything below is optional — empty string when not given. Only the owner ever
    // reads these (the Assign Task dropdown gets just id / name / vendorName).
    mobileNumber: { type: String, default: '', maxlength: 20 },
    address: { type: String, default: '', maxlength: 500 },
    // Where that address is on the map (picked / found on OpenStreetMap, same as a task's site).
    // Absent when no pin was set.
    addressLocation: {
      type: new mongoose.Schema({ lat: Number, lng: Number }, { _id: false }),
      default: undefined,
    },
    email: { type: String, default: '', maxlength: 254 },
    // The login the client's Wi-Fi / monitoring configuration was set up with. The password
    // is stored as typed (the owner has to be able to read it back), so it is never put in
    // the audit log or sent anywhere except to the owner's Clients page.
    wifiEmail: { type: String, default: '', maxlength: 254 },
    wifiPassword: { type: String, default: '', maxlength: 200 },
  },
  { timestamps: true },
);

clientSchema.index({ name: 1, vendorName: 1 });
// Unique, but only among clients that have a code — so existing clients (no code yet) don't clash.
clientSchema.index({ clientCode: 1 }, { unique: true, partialFilterExpression: { clientCode: { $type: 'string' } } });

module.exports = mongoose.model('Client', clientSchema);
