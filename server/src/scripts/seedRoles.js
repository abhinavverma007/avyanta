// One-time (idempotent) setup for the RBAC system. Run once before
// migrateEmployeeRoles.js, and again any time you deploy to a fresh
// database. Safe to run repeatedly — it only creates roles that don't
// already exist by name.
require('dotenv').config();
const mongoose = require('mongoose');
const Role = require('../models/Role');
const { PERMISSION_KEYS } = require('../utils/permissions');

const allFalse = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false]));

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  // The protected, guaranteed-to-exist fallback every new hire gets.
  // All-false — this is exactly what every current laborer already
  // effectively has, so seeding it this way is a zero-regression no-op.
  let employeeRole = await Role.findOne({ name: 'Employee' });
  if (!employeeRole) {
    employeeRole = await Role.create({ name: 'Employee', isSystem: true, permissions: allFalse });
    console.log('Created system role "Employee" (isSystem, all permissions false).');
  } else {
    // A permission key added to PERMISSION_KEYS after this role was first
    // seeded is absent from the stored document, so Mongoose hydrates it
    // with the schema default (true) instead of the intended false — force
    // every known key back to false on every run so this can't drift again.
    employeeRole.permissions = { ...employeeRole.permissions.toObject(), ...allFalse };
    await employeeRole.save();
    console.log('Role "Employee" already exists — permissions re-synced to all-false.');
  }

  // Seeded examples — all-true by design (easier to dial a few back per
  // role than to hunt down which ones to turn on for a new privileged role).
  for (const name of ['Supervisor', 'Manager']) {
    const existing = await Role.findOne({ name });
    if (existing) {
      console.log(`Role "${name}" already exists — left as-is.`);
      continue;
    }
    await Role.create({ name, isSystem: false }); // schema defaults every permission to true
    console.log(`Created role "${name}" (all permissions true).`);
  }

  await mongoose.disconnect();
})();
