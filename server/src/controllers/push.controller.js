const PushSubscription = require('../models/PushSubscription');

exports.subscribe = async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return res.status(400).json({ message: 'A valid push subscription is required.' });
  }

  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { employee: req.employee._id, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
    { upsert: true },
  );

  res.json({ success: true });
};

exports.unsubscribe = async (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) await PushSubscription.deleteOne({ endpoint, employee: req.employee._id });
  res.json({ success: true });
};
