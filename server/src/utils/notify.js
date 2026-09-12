const Notification = require('../models/Notification');
const Employee = require('../models/Employee');

// Fire-and-forget by design, same reasoning as pushNotify.js's
// sendPushToEmployees — never let a notification failure break the action
// that triggered it (approving leave, recording a payout, etc. must always
// succeed regardless of whether the notification write does). Callers must
// NOT await these on the request path.
async function safeInsert(rows) {
  try {
    if (!rows || rows.length === 0) return;
    await Notification.insertMany(rows);
  } catch (err) {
    console.error('notify failed:', err.message);
  }
}

// One specific employee — "your request was reviewed", "your salary was
// paid".
async function notifyEmployee(employeeId, { type, title, body = '', link = '' }) {
  await safeInsert([{ recipientEmployee: employeeId, type, title, body, link }]);
}

// Several employees getting the identical notification at once (e.g. a
// task assigned to a group) — one insertMany instead of N calls.
async function notifyEmployees(employeeIds, { type, title, body = '', link = '' }) {
  if (!employeeIds || employeeIds.length === 0) return;
  await safeInsert(employeeIds.map((id) => ({ recipientEmployee: id, type, title, body, link })));
}

// The true owner only — nothing in the delegable permission catalog covers
// this event (e.g. an employee changing their own UPI ID).
async function notifyAdmin({ type, title, body = '', link = '' }) {
  await safeInsert([{ recipientAdmin: true, type, title, body, link }]);
}

// The true owner AND every delegated Supervisor/Manager whose Role grants
// `permissionKey` — anyone who could actually act on this. Used for "new
// request submitted" events. Never notifies the submitter about their own
// request, even if their Role also happens to grant that permission.
async function notifyReviewers({ permissionKey, excludeEmployeeId, type, title, body = '', link = '' }) {
  // Everything (not just the final insert) needs to be inside this
  // try/catch — this whole function is called fire-and-forget, so an
  // uncaught rejection from the Employee.find below would be an unhandled
  // promise rejection, which can crash the process, not just skip a
  // notification. Same "never let this break the caller" guarantee as
  // safeInsert, just covering the lookup too.
  try {
    const rows = [{ recipientAdmin: true, type, title, body, link }];

    const employees = await Employee.find({ isActive: true }).populate('role');
    for (const emp of employees) {
      if (String(emp._id) === String(excludeEmployeeId)) continue;
      if (emp.role?.permissions?.[permissionKey]) {
        rows.push({ recipientEmployee: emp._id, type, title, body, link });
      }
    }

    await Notification.insertMany(rows);
  } catch (err) {
    console.error('notify failed:', err.message);
  }
}

module.exports = { notifyEmployee, notifyEmployees, notifyAdmin, notifyReviewers };
