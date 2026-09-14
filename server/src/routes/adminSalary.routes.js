const express = require('express');
const requirePermission = require('../middleware/requirePermission');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/salary.controller');

// Mounted at both /admin/salary and /team/salary. A role granted the
// 'salary' permission gets full, unmasked access — view every employee's
// payable/base salary/UPI and record payouts — same as a true Admin, no
// partial/hidden view. Product decision: this permission is all-or-nothing.
const router = express.Router();

router.use(requirePermission('salary'));
router.get('/', asyncHandler(ctrl.summary));
router.get('/:employeeId', asyncHandler(ctrl.detail));
router.post('/:employeeId/pay', asyncHandler(ctrl.recordPayout));

module.exports = router;
