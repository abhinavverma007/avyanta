const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const requirePermission = require('../middleware/requirePermission');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/adminEmployee.controller');

// Mounted at both /admin/employees (true admin) and /team/employees
// (permission-delegated employee) — but unlike the other resources, NOT
// every route here is delegable. Creating an employee, resetting a
// password, and (enforced inside the controller) changing isActive/role
// are hard invariants that always require a true Admin token, regardless
// of what the "employees" permission is set to for a role. Read/update
// stay permission-gated so a Supervisor with "employees" enabled can look
// up and edit basic details.
const router = express.Router();

router.get('/', requirePermission('employees'), asyncHandler(ctrl.list));
router.get('/preview-email', adminAuth, asyncHandler(ctrl.previewEmail));
router.post('/', adminAuth, asyncHandler(ctrl.create));
router.get('/:id', requirePermission('employees'), asyncHandler(ctrl.get));
router.patch('/:id', requirePermission('employees'), asyncHandler(ctrl.update));
router.post('/:id/reset-password', adminAuth, asyncHandler(ctrl.resetPassword));

module.exports = router;
