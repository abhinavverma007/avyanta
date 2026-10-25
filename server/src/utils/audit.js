const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');

// Actions the system takes on its own (no signed-in person) are recorded under this fixed actor.
const SYSTEM_ACTOR_ID = new mongoose.Types.ObjectId('000000000000000000000000');

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

// For actions taken by the system itself, e.g. the end-of-day check marking someone absent.
// Same promise as recordAudit: a logging failure never breaks the work it describes.
async function recordSystemAudit({ action, resourceType, resourceId, summary, metadata }) {
  try {
    await AuditLog.create({
      actorType: 'system',
      actorId: SYSTEM_ACTOR_ID,
      actorName: 'System',
      action,
      resourceType,
      resourceId,
      summary,
      metadata: metadata || {},
    });
  } catch (err) {
    console.error('recordSystemAudit failed:', err.message);
  }
}

module.exports = { recordAudit, recordSystemAudit, SYSTEM_ACTOR_ID };
