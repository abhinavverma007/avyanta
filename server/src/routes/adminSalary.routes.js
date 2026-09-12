const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/salary.controller');

// Mounted only at /admin/salary — never /team/*. Compensation data (base
// salary, payable, UPI) stays owner-only, same as Role management and the
// highest-risk Employee actions (see adminRole.routes.js, requirePermission.js).
// Deliberately strict adminAuth, never requirePermission.
const router = express.Router();

router.use(adminAuth);
router.get('/', asyncHandler(ctrl.summary));
router.get('/:employeeId', asyncHandler(ctrl.detail));
router.post('/:employeeId/pay', asyncHandler(ctrl.recordPayout));

module.exports = router;
