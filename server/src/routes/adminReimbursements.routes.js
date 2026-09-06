const express = require('express');
const requirePermission = require('../middleware/requirePermission');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/adminReimbursement.controller');

// Mounted at both /admin/reimbursements and /team/approvals/reimbursements.
const router = express.Router();

router.use(requirePermission('approvalsReimbursements'));
router.get('/', asyncHandler(ctrl.list));
router.patch('/:id/approve', asyncHandler(ctrl.review('approved')));
router.patch('/:id/reject', asyncHandler(ctrl.review('rejected')));

module.exports = router;
