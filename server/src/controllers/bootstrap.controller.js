// TEMPORARY, unauthenticated, one-time post-deploy bootstrap — runs the
// exact same logic as `npm run migrate:leave-status`, `npm run seed:roles`
// and `npm run migrate:employee-roles`, in that order, over HTTP so it can
// be triggered from Postman without shell access to the deployed instance.
// Every step is idempotent (safe to call more than once). DELETE this
// controller and its route (see routes/bootstrap.routes.js and
// routes/index.js) once you've confirmed production is migrated — it has
// no auth guard at all and can rewrite Employee/Role/Leave documents.
const mongoose = require('mongoose');
const Role = require('../models/Role');
const Employee = require('../models/Employee');
const Leave = require('../models/Leave');
const { PERMISSION_KEYS } = require('../utils/permissions');

exports.run = async (req, res) => {
  const result = { leaveStatus: {}, roles: {}, employeeRoles: {} };

  // 1) migrate:leave-status
  const leaveResult = await Leave.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'approved', reviewNote: 'Auto-approved (pre-approval-workflow record)' } },
  );
  result.leaveStatus = { backfilled: leaveResult.modifiedCount };

  // 2) seed:roles
  const allFalse = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false]));
  let employeeRole = await Role.findOne({ name: 'Employee' });
  if (!employeeRole) {
    employeeRole = await Role.create({ name: 'Employee', isSystem: true, permissions: allFalse });
    result.roles.employee = 'created';
  } else {
    result.roles.employee = 'already existed';
  }
  result.roles.seeded = [];
  for (const name of ['Supervisor', 'Manager']) {
    const existing = await Role.findOne({ name });
    if (existing) {
      result.roles.seeded.push({ name, status: 'already existed' });
      continue;
    }
    await Role.create({ name, isSystem: false });
    result.roles.seeded.push({ name, status: 'created' });
  }

  // 3) migrate:employee-roles (raw collection, same as the script — works
  // regardless of whether the currently-loaded Employee schema still has
  // the old string `role` field or the new ObjectId one)
  const migrateResult = await Employee.collection.updateMany(
    { $or: [{ role: { $type: 'string' } }, { role: { $exists: false } }] },
    { $set: { role: employeeRole._id } },
  );
  result.employeeRoles = { backfilled: migrateResult.modifiedCount };

  res.json({ ok: true, mongoState: mongoose.connection.readyState, result });
};
