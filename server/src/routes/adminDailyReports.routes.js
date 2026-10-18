const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/adminDailyReport.controller');

// Mounted at /admin/daily-reports ONLY — never under /team. Reading the workers'
// daily reports is the owner's alone; no role permission can grant it.
const router = express.Router();

router.use(adminAuth);
router.get('/missing', asyncHandler(ctrl.missing));
router.get('/', asyncHandler(ctrl.list));

module.exports = router;
