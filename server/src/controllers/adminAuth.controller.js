const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const { signToken } = require('../utils/jwt');
const { isValidEmail } = require('../utils/validators');
const { recordAudit } = require('../utils/audit');

function sanitize(admin) {
  return { id: admin._id.toString(), name: admin.name, email: admin.email };
}

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }

  const admin = await Admin.findOne({ email: String(email).toLowerCase().trim() });
  if (!admin) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const match = await bcrypt.compare(password, admin.passwordHash);
  if (!match) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const token = signToken({ sub: admin._id.toString(), role: 'admin', tokenVersion: admin.tokenVersion });
  res.json({ token, admin: sanitize(admin) });
};

exports.me = async (req, res) => {
  res.json({ admin: sanitize(req.admin) });
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new password are required.' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters.' });
  }

  const admin = req.admin;
  const match = await bcrypt.compare(currentPassword, admin.passwordHash);
  if (!match) {
    return res.status(401).json({ message: 'Current password is incorrect.' });
  }

  admin.passwordHash = await bcrypt.hash(String(newPassword), 10);
  // Bumping tokenVersion invalidates any other session on other devices; we
  // hand back a freshly signed token below so this session stays valid —
  // the frontend still forces a logout+re-login as a deliberate UX choice.
  admin.tokenVersion += 1;
  await admin.save();

  await recordAudit(req, {
    action: 'admin.change_own_password',
    resourceType: 'Admin',
    resourceId: admin._id,
    summary: `${admin.name} changed their own password`,
  });

  const token = signToken({ sub: admin._id.toString(), role: 'admin', tokenVersion: admin.tokenVersion });
  res.json({ token, admin: sanitize(admin) });
};

// Open on purpose — no token required, and no limit on how many superadmin
// accounts can be seeded this way. Convenient for bootstrapping via Postman,
// but that means anyone with the URL can create a superadmin account, so
// don't leave this reachable on a deployment you don't fully trust.
exports.register = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const admin = await Admin.create({
    name,
    email: String(email).toLowerCase().trim(),
    passwordHash,
  });

  res.status(201).json({ admin: sanitize(admin) });
};

exports.sanitize = sanitize;
