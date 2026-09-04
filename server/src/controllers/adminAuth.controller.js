const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const { signToken } = require('../utils/jwt');
const { isValidEmail } = require('../utils/validators');
const { resolveAdminFromRequest } = require('../middleware/adminAuth');

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

// Bootstraps the first superadmin on a fresh deployment (no token exists
// yet to gate this with) — but once any admin exists, this requires a valid
// admin token, so only an already-logged-in superadmin can add another one.
exports.register = async (req, res) => {
  const existingCount = await Admin.countDocuments();

  if (existingCount > 0) {
    const requester = await resolveAdminFromRequest(req);
    if (!requester) {
      return res.status(401).json({ message: 'You must be logged in as a superadmin to add another one.' });
    }
  }

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
