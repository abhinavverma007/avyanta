const Role = require('../models/Role');
const Employee = require('../models/Employee');
const { recordAudit } = require('../utils/audit');
const { PERMISSION_KEYS } = require('../utils/permissions');

function sanitize(role) {
  return {
    id: role._id.toString(),
    name: role.name,
    isSystem: role.isSystem,
    permissions: Object.fromEntries(PERMISSION_KEYS.map((k) => [k, !!role.permissions?.[k]])),
    createdAt: role.createdAt,
  };
}

function validatePermissionsPayload(permissions) {
  if (permissions === undefined) return null;
  if (typeof permissions !== 'object' || permissions === null || Array.isArray(permissions)) {
    return 'permissions must be an object.';
  }
  const unknown = Object.keys(permissions).filter((k) => !PERMISSION_KEYS.includes(k));
  if (unknown.length > 0) {
    return `Unknown permission key(s): ${unknown.join(', ')}.`;
  }
  for (const [k, v] of Object.entries(permissions)) {
    if (typeof v !== 'boolean') {
      return `Permission "${k}" must be true or false.`;
    }
  }
  return null;
}

exports.list = async (req, res) => {
  const roles = await Role.find().sort({ isSystem: -1, name: 1 });
  const counts = await Employee.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);
  const countByRole = new Map(counts.map((c) => [c._id.toString(), c.count]));

  res.json({
    roles: roles.map((r) => ({ ...sanitize(r), employeeCount: countByRole.get(r._id.toString()) || 0 })),
  });
};

exports.create = async (req, res) => {
  const { name, permissions } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'A role name is required.' });
  }
  const permissionsError = validatePermissionsPayload(permissions);
  if (permissionsError) {
    return res.status(400).json({ message: permissionsError });
  }

  const existing = await Role.findOne({ name: String(name).trim() });
  if (existing) {
    return res.status(409).json({ message: `A role named "${name}" already exists.` });
  }

  const role = await Role.create({
    name: String(name).trim(),
    permissions: permissions || undefined,
  });

  await recordAudit(req, {
    action: 'role.create',
    resourceType: 'Role',
    resourceId: role._id,
    summary: `Created role "${role.name}"`,
  });

  res.status(201).json({ role: { ...sanitize(role), employeeCount: 0 } });
};

exports.update = async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) return res.status(404).json({ message: 'Role not found.' });

  const { name, permissions } = req.body;
  if (name !== undefined && role.isSystem) {
    return res.status(400).json({ message: 'The default "Employee" role cannot be renamed.' });
  }
  const permissionsError = validatePermissionsPayload(permissions);
  if (permissionsError) {
    return res.status(400).json({ message: permissionsError });
  }

  if (name !== undefined) {
    if (!String(name).trim()) {
      return res.status(400).json({ message: 'A role name is required.' });
    }
    const existing = await Role.findOne({ name: String(name).trim(), _id: { $ne: role._id } });
    if (existing) {
      return res.status(409).json({ message: `A role named "${name}" already exists.` });
    }
    role.name = String(name).trim();
  }
  if (permissions !== undefined) {
    for (const key of PERMISSION_KEYS) {
      if (permissions[key] !== undefined) {
        role.permissions[key] = permissions[key];
      }
    }
  }
  await role.save();

  const employeeCount = await Employee.countDocuments({ role: role._id });

  await recordAudit(req, {
    action: 'role.update',
    resourceType: 'Role',
    resourceId: role._id,
    summary: `Updated role "${role.name}"`,
  });

  res.json({ role: { ...sanitize(role), employeeCount } });
};

exports.remove = async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) return res.status(404).json({ message: 'Role not found.' });
  if (role.isSystem) {
    return res.status(400).json({ message: 'The default "Employee" role cannot be deleted.' });
  }

  const employeeCount = await Employee.countDocuments({ role: role._id });
  if (employeeCount > 0) {
    return res.status(409).json({
      message: `${employeeCount} employee(s) still have this role — reassign them first.`,
    });
  }

  await role.deleteOne();

  await recordAudit(req, {
    action: 'role.delete',
    resourceType: 'Role',
    resourceId: role._id,
    summary: `Deleted role "${role.name}"`,
  });

  res.json({ message: 'Role deleted.' });
};

exports.sanitize = sanitize;
