const mongoose = require('mongoose');

// One document per browser/device an employee has enabled notifications on
// — the same employee can have several (phone + desktop, say). endpoint is
// globally unique per browser install, so re-subscribing the same
// device/browser (even for a different employee, e.g. a shared device)
// just updates which employee it now belongs to.
const pushSubscriptionSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
