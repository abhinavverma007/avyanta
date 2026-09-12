const mongoose = require('mongoose');

// A single in-app notification. `recipientAdmin: true` means "visible to
// the true owner's Admin session"; `recipientEmployee` means "visible to
// that one employee's session" (a delegated Supervisor/Manager's own
// reviewer notifications live here too, addressed to their employee id —
// see notify.js). An event that concerns several people (e.g. a new leave
// request, seen by the owner AND every delegated Supervisor/Manager who can
// review leave) is stored as one row per recipient rather than a single row
// with multiple audiences, so read/unread state is tracked per-recipient.
const notificationSchema = new mongoose.Schema(
  {
    recipientAdmin: { type: Boolean, default: false },
    recipientEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    link: { type: String, default: '' }, // a full frontend path, e.g. '/requests' or '/superadmin/approvals?section=leave&employee=EMP01'
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notificationSchema.index({ recipientAdmin: 1, createdAt: -1 });
notificationSchema.index({ recipientEmployee: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
