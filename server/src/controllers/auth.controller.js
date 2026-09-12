const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const { signToken } = require('../utils/jwt');
const { isValidEmail, isValidUpiId } = require('../utils/validators');
const { recordAudit } = require('../utils/audit');
const { notifyAdmin } = require('../utils/notify');

function sanitize(emp) {
  return {
    id: emp._id.toString(),
    name: emp.name,
    role: emp.role && emp.role.name
      ? { id: emp.role._id.toString(), name: emp.role.name, permissions: emp.role.permissions }
      : null,
    designation: emp.designation,
    department: emp.department,
    email: emp.email,
    phone: emp.phone,
    employeeId: emp.employeeId,
    joinDate: emp.joinDate,
    location: emp.location,
    // Unmasked — this is always the employee's own record here, never
    // someone else's (contrast adminEmployee.controller.js's sanitize,
    // which masks/withholds this for anyone who isn't the true Admin).
    upiId: emp.upiId,
  };
}

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }

  const employee = await Employee.findOne({ email: String(email).toLowerCase().trim() }).populate('role');
  if (!employee || !employee.isActive) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const match = await bcrypt.compare(password, employee.passwordHash);
  if (!match) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const token = signToken({ sub: employee._id.toString(), role: 'employee', tokenVersion: employee.tokenVersion });
  res.json({ token, user: sanitize(employee) });
};

exports.me = async (req, res) => {
  res.json({ user: sanitize(req.employee) });
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new password are required.' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters.' });
  }

  const employee = req.employee;
  const match = await bcrypt.compare(currentPassword, employee.passwordHash);
  if (!match) {
    return res.status(401).json({ message: 'Current password is incorrect.' });
  }

  employee.passwordHash = await bcrypt.hash(String(newPassword), 10);
  // Bumping tokenVersion invalidates any other session on other devices;
  // we hand back a freshly signed token below so this session stays logged in.
  employee.tokenVersion += 1;
  await employee.save();

  await recordAudit(req, {
    action: 'employee.change_own_password',
    resourceType: 'Employee',
    resourceId: employee._id,
    summary: `${employee.name} changed their own password`,
  });

  const token = signToken({ sub: employee._id.toString(), role: 'employee', tokenVersion: employee.tokenVersion });
  res.json({ token, user: sanitize(employee) });
};

// Self-service — an employee can change only their OWN UPI ID, and it
// takes effect immediately (product decision: simpler/faster than an
// approval flow, same trust level as changing their own password above).
// Deliberately a separate, narrower path from adminEmployee.controller.js's
// update(): that one still requires a true Admin token for anyone editing
// UPI on someone else's record — a delegated Supervisor/Manager still can't
// touch another employee's UPI there, this only ever touches req.employee's
// own document.
exports.updateUpi = async (req, res) => {
  const upiId = String(req.body.upiId || '').trim();
  if (!isValidUpiId(upiId)) {
    return res.status(400).json({ message: 'Enter a valid UPI ID, e.g. name@okhdfcbank.' });
  }

  const employee = req.employee;
  const previousUpiId = employee.upiId;
  employee.upiId = upiId;
  await employee.save();

  await recordAudit(req, {
    action: 'employee.upi_self_update',
    resourceType: 'Employee',
    resourceId: employee._id,
    summary: `${employee.name} updated their own UPI ID`,
    metadata: { previousUpiId, upiId },
  });

  // Not awaited — see the note in notify.js. Owner-only visibility on
  // purpose (see updateUpi's own comment above) — no permission fans this
  // out to anyone else.
  notifyAdmin({
    type: 'employee.upi_self_update',
    title: `${employee.name} updated their own UPI ID`,
    body: previousUpiId ? `Changed from ${previousUpiId} to ${upiId}` : `Set to ${upiId}`,
    link: `/superadmin/employees/${employee._id}/edit?focus=upi`,
  });

  res.json({ user: sanitize(employee) });
};

exports.sanitize = sanitize;
