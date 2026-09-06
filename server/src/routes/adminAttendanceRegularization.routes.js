const express = require('express');
const requirePermission = require('../middleware/requirePermission');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/adminAttendanceRegularization.controller');

// Mounted at both /admin/regularizations and /team/approvals/regularizations.
const router = express.Router();

router.use(requirePermission('approvalsRegularization'));
router.get('/', asyncHandler(ctrl.list));
router.patch('/:id/approve', asyncHandler(ctrl.review('approved')));
router.patch('/:id/reject', asyncHandler(ctrl.review('rejected')));

module.exports = router;
