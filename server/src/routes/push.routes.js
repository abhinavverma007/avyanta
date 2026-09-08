const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/push.controller');

const router = express.Router();

router.use(auth);
router.post('/subscribe', asyncHandler(ctrl.subscribe));
router.post('/unsubscribe', asyncHandler(ctrl.unsubscribe));

module.exports = router;
