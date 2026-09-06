const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const Role = require('../models/Role');
const { generatePassword } = require('../utils/password');
const { generateUniqueEmail, generateEmployeeId } = require('../utils/employeeIdentity');
const { recordAudit } = require('../utils/audit');

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Accepts digits with or without hyphens; stores canonical 12-digit form
// (real Aadhaar numbers are 12 digits). Throws a 400-flagged error if a
// non-empty value isn't exactly 12 digits.
function normalizeAadhaar(value) {
  if (value === undefined || value === null || value === '') return '';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 12) {
    const err = new Error('Aadhaar number must be exactly 12 digits.');
    err.status = 400;
    throw err;
  }
  return digits;
}

function sanitize(emp) {
  return {
    id: emp._id.toString(),
    name: emp.name,
    email: emp.email,
    role: emp.role && emp.role.name ? { id: emp.role._id.toString(), name: emp.role.name } : null,
    designation: emp.designation,
    department: emp.department,
    phone: emp.phone,
    employeeId: emp.employeeId,
    joinDate: emp.joinDate,
    location: emp.location,
    aadhaarNumber: emp.aadhaarNumber,
    upiId: emp.upiId,
    shiftStart: emp.shiftStart,
    salaryMonthly: emp.salaryMonthly,
    paidLeavesPerMonth: emp.paidLeavesPerMonth,
    isActive: emp.isActive,
    createdAt: emp.createdAt,
  };
}

exports.list = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const search = String(req.query.search || '').trim();

  const filter = search
    ? {
        $or: [
          { name: { $regex: escapeRegex(search), $options: 'i' } },
          { email: { $regex: escapeRegex(search), $options: 'i' } },
          { employeeId: { $regex: escapeRegex(search), $options: 'i' } },
          { department: { $regex: escapeRegex(search), $options: 'i' } },
        ],
      }
    : {};

  const [employees, total] = await Promise.all([
    Employee.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('role', 'name'),
    Employee.countDocuments(filter),
  ]);

  res.json({
    employees: employees.map(sanitize),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
};

exports.get = async (req, res) => {
  const employee = await Employee.findById(req.params.id).populate('role', 'name');
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });
  res.json({ employee: sanitize(employee) });
};

// Live preview for the "Add Employee" form — shows what email would be
// generated, without reserving anything. The actual create() call generates
// it fresh again, so this is just a UI convenience, not a hold on the value.
exports.previewEmail = async (req, res) => {
  const name = String(req.query.name || '').trim();
  if (!name) return res.json({ email: '' });
  const email = await generateUniqueEmail(name);
  res.json({ email });
};

// Email and employee ID are never typed by the superadmin — both are
// generated here so there's nothing to get wrong or collide on. Admin-only
// route (see adminEmployees.routes.js), so the `role` field here can be
// trusted without an extra actor check.
exports.create = async (req, res) => {
  const { name, joinDate } = req.body;
  for (const [key, val] of Object.entries({ name, joinDate })) {
    if (!val) return res.status(400).json({ message: `${key} is required.` });
  }

  let role;
  if (req.body.role) {
    role = await Role.findById(req.body.role);
    if (!role) return res.status(400).json({ message: 'Selected role was not found.' });
  } else {
    role = await Role.findOne({ isSystem: true });
    if (!role) return res.status(500).json({ message: 'Default "Employee" role is missing — run the seed:roles script.' });
  }

  const [email, employeeId] = await Promise.all([generateUniqueEmail(name), generateEmployeeId()]);
  const password = req.body.password || generatePassword();
  const passwordHash = await bcrypt.hash(password, 10);

  const employee = await Employee.create({
    name,
    email,
    passwordHash,
    role: role._id,
    employeeId,
    designation: req.body.designation || '',
    department: req.body.department || '',
    phone: req.body.phone || '',
    joinDate,
    location: req.body.location || '',
    aadhaarNumber: normalizeAadhaar(req.body.aadhaarNumber),
    upiId: String(req.body.upiId || '').trim(),
    shiftStart: req.body.shiftStart || '09:30',
    salaryMonthly: req.body.salaryMonthly || 0,
    paidLeavesPerMonth: req.body.paidLeavesPerMonth || 0,
  });
  await employee.populate('role', 'name');

  await recordAudit(req, {
    action: 'employee.create',
    resourceType: 'Employee',
    resourceId: employee._id,
    summary: `Created employee ${employee.name} (${employee.employeeId})`,
  });

  res.status(201).json({ employee: sanitize(employee), generatedPassword: password });
};

// This route is reachable both as a true Admin (/admin/employees/:id) and as
// a permission-delegated Employee (/team/employees/:id) — `role` and
// `isActive` are hard invariants that stay Admin-only no matter what the
// "employees" permission is set to for a role, so they're stripped here as
// a second line of defense even though the frontend already hides those
// controls outside admin scope.
exports.update = async (req, res) => {
  const allowed = [
    'name', 'designation', 'department', 'phone', 'location',
    'salaryMonthly', 'paidLeavesPerMonth', 'shiftStart',
  ];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (req.body.aadhaarNumber !== undefined) {
    updates.aadhaarNumber = normalizeAadhaar(req.body.aadhaarNumber);
  }
  if (req.body.upiId !== undefined) {
    updates.upiId = String(req.body.upiId).trim();
  }

  if (req.admin) {
    if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;
    if (req.body.role !== undefined) {
      const role = await Role.findById(req.body.role);
      if (!role) return res.status(400).json({ message: 'Selected role was not found.' });
      updates.role = role._id;
    }
  } else if (req.body.isActive !== undefined || req.body.role !== undefined) {
    return res.status(403).json({ message: 'Only the owner can change an employee\'s active status or role.' });
  }

  const before = await Employee.findById(req.params.id);
  if (!before) return res.status(404).json({ message: 'Employee not found.' });

  const employee = await Employee.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
    .populate('role', 'name');

  if (updates.role !== undefined && String(updates.role) !== String(before.role)) {
    await recordAudit(req, {
      action: 'employee.role_change',
      resourceType: 'Employee',
      resourceId: employee._id,
      summary: `Changed ${employee.name}'s role to "${employee.role?.name}"`,
    });
  } else if (updates.isActive !== undefined && updates.isActive !== before.isActive) {
    await recordAudit(req, {
      action: updates.isActive ? 'employee.activate' : 'employee.deactivate',
      resourceType: 'Employee',
      resourceId: employee._id,
      summary: `${updates.isActive ? 'Activated' : 'Deactivated'} ${employee.name}`,
    });
  } else {
    await recordAudit(req, {
      action: 'employee.update',
      resourceType: 'Employee',
      resourceId: employee._id,
      summary: `Updated employee ${employee.name} (${employee.employeeId})`,
    });
  }

  res.json({ employee: sanitize(employee) });
};

exports.resetPassword = async (req, res) => {
  const password = req.body.password || generatePassword();
  const passwordHash = await bcrypt.hash(password, 10);

  // Bumping tokenVersion invalidates any JWT already issued to this employee —
  // their next request (or page load) gets a 401 and is bounced to login.
  const employee = await Employee.findByIdAndUpdate(
    req.params.id,
    { passwordHash, $inc: { tokenVersion: 1 } },
    { new: true },
  ).populate('role', 'name');
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });

  await recordAudit(req, {
    action: 'employee.reset_password',
    resourceType: 'Employee',
    resourceId: employee._id,
    summary: `Reset password for ${employee.name} (${employee.employeeId})`,
  });

  res.json({ employee: sanitize(employee), generatedPassword: password });
};

exports.sanitize = sanitize;
