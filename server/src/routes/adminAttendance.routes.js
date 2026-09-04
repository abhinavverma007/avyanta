const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/adminAttendance.controller');

const router = express.Router();

router.use(adminAuth);
router.get('/:employeeId/monthly', asyncHandler(ctrl.monthly));

module.exports = router;
