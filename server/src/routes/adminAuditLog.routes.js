const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/adminAuditLog.controller');

// Strict adminAuth only — a delegated Supervisor/Manager must never be able
// to read the audit trail, including their own entries in it.
const router = express.Router();

router.use(adminAuth);
router.get('/', asyncHandler(ctrl.list));

module.exports = router;
