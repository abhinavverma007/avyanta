const Notification = require('../models/Notification');

// Mounted twice (see notifications.routes.js / adminNotifications.routes.js)
// with different auth middleware ahead of it — exactly one of req.admin /
// req.employee is ever set, which is what decides whose notifications these
// calls touch.
function scopeFilter(req) {
  return req.admin ? { recipientAdmin: true } : { recipientEmployee: req.employee._id };
}

function sanitize(n) {
  return {
    id: n._id.toString(),
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    read: n.read,
    createdAt: n.createdAt,
  };
}

exports.list = async (req, res) => {
  const filter = scopeFilter(req);
  const [notifications, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(50),
    Notification.countDocuments({ ...filter, read: false }),
  ]);
  res.json({ notifications: notifications.map(sanitize), unreadCount });
};

exports.markRead = async (req, res) => {
  const filter = { ...scopeFilter(req), _id: req.params.id };
  const notification = await Notification.findOneAndUpdate(filter, { read: true }, { new: true });
  if (!notification) return res.status(404).json({ message: 'Notification not found.' });
  res.json({ notification: sanitize(notification) });
};

exports.markAllRead = async (req, res) => {
  await Notification.updateMany(scopeFilter(req), { read: true });
  res.json({ message: 'All notifications marked as read.' });
};
