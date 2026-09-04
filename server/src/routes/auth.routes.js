const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/auth.controller');

const router = express.Router();

router.post('/login', asyncHandler(ctrl.login));
router.get('/me', auth, asyncHandler(ctrl.me));
router.post('/change-password', auth, asyncHandler(ctrl.changePassword));

module.exports = router;
