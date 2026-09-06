const express = require('express');
const requirePermission = require('../middleware/requirePermission');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/adminSalaryAdvance.controller');

// Mounted at both /admin/advances and /team/advances.
const router = express.Router();

router.use(requirePermission('approvalsAdvance'));
router.get('/', asyncHandler(ctrl.list));
router.patch('/:id/approve', asyncHandler(ctrl.review('approved')));
router.patch('/:id/reject', asyncHandler(ctrl.review('rejected')));

module.exports = router;
