const mongoose = require('mongoose');
const { PERMISSION_KEYS } = require('../utils/permissions');

// New roles default every permission to true (per explicit product decision —
// easier to dial back a handful of toggles on a new privileged role than to
// hunt down which ones to turn on). The one exception is the seeded
// "Employee" role itself, which the seed script explicitly forces to all
// -false right after creation — that's what every current laborer already
// effectively has, so shipping this is a zero-regression no-op for them.
const permissionsSchemaFields = {};
for (const key of PERMISSION_KEYS) {
  permissionsSchemaFields[key] = { type: Boolean, default: true };
}
const permissionsSchema = new mongoose.Schema(permissionsSchemaFields, { _id: false });

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    // True only for the seeded "Employee" role — the guaranteed-to-exist
    // fallback every new hire gets. Protected from rename/delete so there's
    // always a safe default to fall back to (see adminRole.controller.js).
    isSystem: { type: Boolean, default: false },
    permissions: { type: permissionsSchema, default: () => ({}) },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Role', roleSchema);
