const express = require('express');
const requirePermission = require('../middleware/requirePermission');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/adminAttendance.controller');

// Mounted at both /admin/attendance and /team/employees/attendance — it's
// the "see attendance history" link off the Employees table.
const router = express.Router();

router.use(requirePermission('employees'));
router.get('/:employeeId/monthly', asyncHandler(ctrl.monthly));

module.exports = router;
