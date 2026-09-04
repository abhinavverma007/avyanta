const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/attendance.controller');

const router = express.Router();

router.use(auth);
router.post('/punch', asyncHandler(ctrl.punch));
router.get('/today', asyncHandler(ctrl.today));
router.get('/monthly', asyncHandler(ctrl.monthly));

module.exports = router;
