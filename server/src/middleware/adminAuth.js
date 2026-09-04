const { verifyToken } = require('../utils/jwt');
const Admin = require('../models/Admin');

// Just "is there a valid logged-in admin behind this request?" — used by
// adminAuth.controller.js's register() to decide whether an already-logged-in
// superadmin is adding another one, without needing to reject the request
// outright when there isn't one (unlike the adminAuth middleware below).
async function resolveAdminFromRequest(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;

  try {
    const payload = verifyToken(token);
    if (payload.role !== 'admin') return null;
    const admin = await Admin.findById(payload.sub);
    if (!admin || payload.tokenVersion !== admin.tokenVersion) return null;
    return admin;
  } catch {
    return null;
  }
}

async function adminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const payload = verifyToken(token);
    if (payload.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }
    const admin = await Admin.findById(payload.sub);
    if (!admin || payload.tokenVersion !== admin.tokenVersion) {
      return res.status(401).json({ message: 'Invalid or expired session.' });
    }
    req.admin = admin;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired session.' });
  }
}

module.exports = adminAuth;
module.exports.resolveAdminFromRequest = resolveAdminFromRequest;
