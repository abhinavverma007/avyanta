const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/notification.controller');

// True-owner-only — a delegated Supervisor/Manager's own notifications
// (including "new request to review" ones) live under /notifications
// instead, addressed to their employee id (see notify.js). Deliberately
// strict adminAuth, never requirePermission, never mounted under /team/*.
const router = express.Router();

router.get('/', adminAuth, asyncHandler(ctrl.list));
router.patch('/:id/read', adminAuth, asyncHandler(ctrl.markRead));
router.patch('/read-all', adminAuth, asyncHandler(ctrl.markAllRead));

module.exports = router;
