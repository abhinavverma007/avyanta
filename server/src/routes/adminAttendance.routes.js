const express = require('express');
const requirePermission = require('../middleware/requirePermission');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/adminAttendance.controller');

// Mounted at both /admin/attendance and /team/employees/attendance — it's
// the "see attendance history" link off the Employees table.
const router = express.Router();

router.use(requirePermission('employees'));
router.get('/:employeeId/monthly', asyncHandler(ctrl.monthly));
// Owner-only: adminAuth rejects a delegated Supervisor/Manager even though this
// router is also mounted at /team (and the controller checks req.admin again).
router.put('/:employeeId/day/:date', adminAuth, asyncHandler(ctrl.overrideDay));

module.exports = router;
