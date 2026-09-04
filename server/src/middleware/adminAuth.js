const { verifyToken } = require('../utils/jwt');
const Admin = require('../models/Admin');

module.exports = async function adminAuth(req, res, next) {
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
};
