const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/salary.controller');

const router = express.Router();

router.use(adminAuth);
router.get('/', asyncHandler(ctrl.summary));
router.get('/:employeeId', asyncHandler(ctrl.detail));
router.post('/:employeeId/pay', asyncHandler(ctrl.recordPayout));

module.exports = router;
