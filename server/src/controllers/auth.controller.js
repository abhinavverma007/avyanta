const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const { signToken } = require('../utils/jwt');
const { isValidEmail } = require('../utils/validators');
const { recordAudit } = require('../utils/audit');

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

exports.sanitize = sanitize;
