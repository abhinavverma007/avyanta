const mongoose = require('mongoose');

// One entry per mutating action taken through the admin/team surface —
// actor fields are denormalized (name captured at write time) so the log
// still reads correctly even if the actor is later renamed, deactivated, or
// deleted. Always admin-readable only (see adminAuditLog.controller.js) —
// a delegated Supervisor/Manager must never see this trail, including their
// own entries in it.
const auditLogSchema = new mongoose.Schema(
  {
    actorType: { type: String, enum: ['admin', 'employee'], required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, required: true },
    actorName: { type: String, required: true },
    action: { type: String, required: true }, // e.g. 'employee.update', 'leave.approve'
    resourceType: { type: String, required: true }, // e.g. 'Employee', 'Leave'
    resourceId: { type: mongoose.Schema.Types.ObjectId },
    summary: { type: String, required: true }, // human-readable one-liner
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
