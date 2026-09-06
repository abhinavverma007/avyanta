const AuditLog = require('../models/AuditLog');

function sanitize(entry) {
  return {
    id: entry._id.toString(),
    actorType: entry.actorType,
    actorId: entry.actorId.toString(),
    actorName: entry.actorName,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId ? entry.resourceId.toString() : null,
    summary: entry.summary,
    metadata: entry.metadata,
    createdAt: entry.createdAt,
  };
}

exports.list = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const filter = {};
  if (req.query.actorId) filter.actorId = req.query.actorId;
  if (req.query.action) filter.action = req.query.action;
  if (req.query.resourceType) filter.resourceType = req.query.resourceType;
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }

  const [entries, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  res.json({
    entries: entries.map(sanitize),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
};
