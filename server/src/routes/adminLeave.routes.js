const express = require('express');
const requirePermission = require('../middleware/requirePermission');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/adminLeave.controller');

// Mounted at both /admin/leaves and /team/approvals/leaves.
const router = express.Router();

router.use(requirePermission('approvalsLeave'));
router.get('/', asyncHandler(ctrl.list));
router.patch('/:id/approve', asyncHandler(ctrl.review('approved')));
router.patch('/:id/reject', asyncHandler(ctrl.review('rejected')));
// Owner-only (the controller rejects anyone but req.admin) — this router is also mounted at /team.
router.patch('/:id/override', asyncHandler(ctrl.override));

module.exports = router;
