// One-time migration: Employee.role used to store the literal string
// 'employee' (the old fixed enum); it's now a reference to a Role document.
// Run seed:roles first, then this, immediately after deploying this change
// — same "run once, right after deploying" precedent as migrate:leave-status.
//
// Uses the raw driver (Employee.collection), not the Mongoose model, so it
// works correctly regardless of whether the old or new schema is what's
// currently loaded in the process running this script.
require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const Role = require('../models/Role');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const employeeRole = await Role.findOne({ name: 'Employee', isSystem: true });
  if (!employeeRole) {
    console.error('System role "Employee" not found — run `npm run seed:roles` first.');
    process.exitCode = 1;
    await mongoose.disconnect();
    return;
  }

  const result = await Employee.collection.updateMany(
    { $or: [{ role: { $type: 'string' } }, { role: { $exists: false } }] },
    { $set: { role: employeeRole._id } },
  );

  console.log(`Backfilled ${result.modifiedCount} employee(s) to the "Employee" role.`);
  await mongoose.disconnect();
})();
