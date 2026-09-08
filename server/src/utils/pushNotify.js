const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@sundesh.in',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

// Fire-and-forget by design — callers must NOT await this on the request
// path. Each webpush.sendNotification is an external HTTPS round-trip to
// Google/Mozilla/Apple's push service (can easily be 100-500ms+ per
// subscription); blocking a task-assignment response on that would make
// "critical" owner actions hostage to a third party's network. The promise
// this returns can also never reject, so an un-awaited call can't produce
// an unhandled rejection either.
async function sendPushToEmployees(employeeIds, payload) {
  try {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
    if (!employeeIds || employeeIds.length === 0) return;

    const subs = await PushSubscription.find({ employee: { $in: employeeIds } }).lean();
    const body = JSON.stringify(payload);

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body);
        } catch (err) {
          // A 404/410 means the browser subscription is gone for good
          // (uninstalled, permission revoked, data cleared) — prune it so
          // it doesn't keep failing forever.
          if (err.statusCode === 404 || err.statusCode === 410) {
            await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
          } else {
            console.error('push notify failed:', err.message);
          }
        }
      }),
    );
  } catch (err) {
    console.error('sendPushToEmployees failed:', err.message);
  }
}

module.exports = { sendPushToEmployees };
