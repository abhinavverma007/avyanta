const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/adminAuth.controller');

const router = express.Router();

router.post('/login', asyncHandler(ctrl.login));
router.get('/me', adminAuth, asyncHandler(ctrl.me));
// Not behind the adminAuth middleware — see adminAuth.controller.js's
// register() for how this is protected instead (open only while zero
// admins exist; requires a valid admin token after that).
router.post('/register', asyncHandler(ctrl.register));

module.exports = router;
