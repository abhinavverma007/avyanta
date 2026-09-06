const { verifyToken } = require('../utils/jwt');
const Admin = require('../models/Admin');
const Employee = require('../models/Employee');
const { PERMISSION_KEYS } = require('../utils/permissions');

// Gates a route to either a true Admin (always full access — an owner
// implicitly has every permission) or an Employee whose assigned Role has
// the given permission enabled. This is what lets a Supervisor/Manager
// reach the exact same controllers as the superadmin, through the /team/*
// mount, without ever needing an admin account.
//
// Mounting the same router at both /admin/* (still adminAuth-only for the
// truly sensitive actions — see adminEmployees.routes.js) and /team/* with
// this middleware is what makes the delegation work without duplicating any
// controller code.
module.exports = function requirePermission(key) {
  if (!PERMISSION_KEYS.includes(key)) {
    throw new Error(`requirePermission: unknown permission key "${key}"`);
  }

  return async (req, res, next) => {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({ message: 'Invalid or expired session.' });
    }

    try {
      if (payload.role === 'admin') {
        const admin = await Admin.findById(payload.sub);
        if (!admin || payload.tokenVersion !== admin.tokenVersion) {
          return res.status(401).json({ message: 'Invalid or expired session.' });
        }
        req.admin = admin;
        return next();
      }

      if (payload.role === 'employee') {
        const employee = await Employee.findById(payload.sub).populate('role');
        if (!employee || !employee.isActive || payload.tokenVersion !== employee.tokenVersion) {
          return res.status(401).json({ message: 'Invalid or expired session.' });
        }
        if (!employee.role || !employee.role.permissions?.[key]) {
          return res.status(403).json({ message: 'You do not have permission to access this.' });
        }
        req.employee = employee;
        return next();
      }

      return res.status(403).json({ message: 'Access required.' });
    } catch {
      return res.status(401).json({ message: 'Invalid or expired session.' });
    }
  };
};
