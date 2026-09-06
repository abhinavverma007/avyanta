const { verifyToken } = require('../utils/jwt');
const Employee = require('../models/Employee');

module.exports = async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const payload = verifyToken(token);
    if (payload.role !== 'employee') {
      return res.status(403).json({ message: 'Employee access required.' });
    }
    const employee = await Employee.findById(payload.sub).populate('role');
    if (!employee || !employee.isActive || payload.tokenVersion !== employee.tokenVersion) {
      return res.status(401).json({ message: 'Invalid or expired session.' });
    }
    req.employee = employee;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired session.' });
  }
};
