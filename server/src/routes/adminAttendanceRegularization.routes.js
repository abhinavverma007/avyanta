const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/adminAttendanceRegularization.controller');

const router = express.Router();

router.use(adminAuth);
router.get('/', asyncHandler(ctrl.list));
router.patch('/:id/approve', asyncHandler(ctrl.review('approved')));
router.patch('/:id/reject', asyncHandler(ctrl.review('rejected')));

module.exports = router;
