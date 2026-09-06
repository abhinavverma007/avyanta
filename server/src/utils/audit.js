const AuditLog = require('../models/AuditLog');

// Called explicitly at each mutation site — deliberately not implicit
// middleware magic, so the list of audited actions stays a plain,
// greppable list (see the recordAudit call sites) rather than something
// that can silently drift as routes change.
//
// A logging failure must never break the actual request — the mutation it
// describes has already succeeded by the time this is called, so this only
// ever logs a console error and swallows the failure.
async function recordAudit(req, { action, resourceType, resourceId, summary, metadata }) {
  try {
    const actorType = req.admin ? 'admin' : 'employee';
    const actor = req.admin || req.employee;
    if (!actor) return; // should never happen — every route this is called from is authenticated

    await AuditLog.create({
      actorType,
      actorId: actor._id,
      actorName: actor.name,
      action,
      resourceType,
      resourceId,
      summary,
      metadata: metadata || {},
    });
  } catch (err) {
    console.error('recordAudit failed:', err.message);
  }
}

module.exports = { recordAudit };
