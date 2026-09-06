const express = require('express');
const requirePermission = require('../middleware/requirePermission');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/salary.controller');

// Mounted at both /admin/salary and /team/salary.
const router = express.Router();

router.use(requirePermission('salary'));
router.get('/', asyncHandler(ctrl.summary));
router.get('/:employeeId', asyncHandler(ctrl.detail));
router.post('/:employeeId/pay', asyncHandler(ctrl.recordPayout));

module.exports = router;
