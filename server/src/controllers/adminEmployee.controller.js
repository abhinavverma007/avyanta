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

// Canonical stored form is "+91" + exactly 10 digits. Only ever called for a
// genuinely new or actively-changed value — see update()'s "unchanged from
// stored" check below, which is what keeps pre-existing employees (created
// before this validation existed, possibly with no phone or some other
// format) from being blocked just because an unrelated field on the same
// form got saved.
function normalizePhone(value) {
  if (value === undefined || value === null || value === '') return '';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 10) {
    const err = new Error('Phone number must be +91 followed by exactly 10 digits.');
    err.status = 400;
    throw err;
  }
  return `+91${digits}`;
}

// Aadhaar/UPI are sensitive PII — a delegated Supervisor/Manager (anyone
// short of the true owner) only ever sees a masked form, never the raw
// value, regardless of whether their role has "employees" permission.
function maskAadhaar(value) {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `XXXX-XXXX-${digits.slice(-4)}`;
}
function maskUpi(value) {
  if (!value) return '';
  const at = value.indexOf('@');
  if (at <= 0) return '••••';
  return `••••${value.slice(at)}`;
}

function sanitize(emp, { mask = false } = {}) {
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
    aadhaarNumber: mask ? maskAadhaar(emp.aadhaarNumber) : emp.aadhaarNumber,
    upiId: mask ? maskUpi(emp.upiId) : emp.upiId,
    shiftStart: emp.shiftStart || '09:30',
    // Withheld entirely (not just masked — there's no natural partial
    // reveal for a pay figure the way there is for Aadhaar/UPI) for anyone
    // short of the true owner, same as Aadhaar/UPI above.
    // Explicit fallbacks, not just the schema default — list()/get() use
    // .lean() below (skips Mongoose hydration entirely), so a document
    // missing one of these fields would otherwise come back as undefined.
    salaryMonthly: mask ? null : (emp.salaryMonthly ?? 0),
    paidLeavesPerMonth: emp.paidLeavesPerMonth ?? 0,
    isActive: emp.isActive ?? true,
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
    Employee.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('role', 'name').lean(),
    Employee.countDocuments(filter),
  ]);

  res.json({
    employees: employees.map((e) => sanitize(e, { mask: !req.admin })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
};

exports.get = async (req, res) => {
  const employee = await Employee.findById(req.params.id).populate('role', 'name').lean();
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });
  res.json({ employee: sanitize(employee, { mask: !req.admin }) });
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
    phone: normalizePhone(req.body.phone),
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
  // Read-only — never saved directly, only compared against and used to
  // decide what changed, so .lean() is safe here (no hydration needed).
  const before = await Employee.findById(req.params.id).lean();
  if (!before) return res.status(404).json({ message: 'Employee not found.' });

  // A Supervisor/Manager is themselves an Employee document — without this,
  // "employees" permission would let them edit their own salary, role, etc.
  // through this very feature, the same conflict-of-interest gap the
  // self-approval guard (reviewGuard.js) closes for Leave/Reimbursement/
  // Advance/Regularization requests.
  if (!req.admin && req.employee && String(before._id) === String(req.employee._id)) {
    return res.status(403).json({ message: 'You cannot edit your own employee record — ask the owner to make this change.' });
  }

  const allowed = ['name', 'designation', 'department', 'location', 'shiftStart'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (req.body.phone !== undefined) {
    const incoming = String(req.body.phone).trim();
    // Validate the format only when the value is actually changing — an
    // employee saved before this validation existed (possibly blank or in
    // some other phone format) must never get blocked just because the
    // owner edited an unrelated field on the same form and phone was
    // resent unchanged.
    updates.phone = incoming === (before.phone || '') ? incoming : normalizePhone(incoming);
  }

  // Salary, paid-leave allowance, Aadhaar, and UPI are owner-only to change
  // — financially/PII-sensitive enough that they shouldn't ride along with
  // the general "employees" permission a Supervisor/Manager might have.
  // (The frontend also simply never sends these fields outside admin
  // scope — this is the enforcing layer, not just a UI convenience.)
  if (req.admin) {
    if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;
    if (req.body.role !== undefined) {
      const role = await Role.findById(req.body.role);
      if (!role) return res.status(400).json({ message: 'Selected role was not found.' });
      updates.role = role._id;
    }
    if (req.body.salaryMonthly !== undefined) updates.salaryMonthly = req.body.salaryMonthly;
    if (req.body.paidLeavesPerMonth !== undefined) updates.paidLeavesPerMonth = req.body.paidLeavesPerMonth;
    if (req.body.aadhaarNumber !== undefined) updates.aadhaarNumber = normalizeAadhaar(req.body.aadhaarNumber);
    if (req.body.upiId !== undefined) updates.upiId = String(req.body.upiId).trim();
  } else if (
    req.body.isActive !== undefined || req.body.role !== undefined ||
    req.body.salaryMonthly !== undefined || req.body.paidLeavesPerMonth !== undefined ||
    req.body.aadhaarNumber !== undefined || req.body.upiId !== undefined
  ) {
    return res.status(403).json({ message: 'Only the owner can change salary, paid leaves, Aadhaar, UPI ID, active status, or role.' });
  }

  const employee = await Employee.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
    .populate('role', 'name')
    .lean();

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

  res.json({ employee: sanitize(employee, { mask: !req.admin }) });
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
  ).populate('role', 'name').lean();
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
