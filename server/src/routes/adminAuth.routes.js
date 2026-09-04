const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/adminAuth.controller');

const router = express.Router();

router.post('/login', asyncHandler(ctrl.login));
router.get('/me', adminAuth, asyncHandler(ctrl.me));
router.post('/change-password', adminAuth, asyncHandler(ctrl.changePassword));
// Deliberately open — see the comment on register() in adminAuth.controller.js.
router.post('/register', asyncHandler(ctrl.register));

module.exports = router;
