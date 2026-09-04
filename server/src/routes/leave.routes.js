const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/leave.controller');

const router = express.Router();

router.use(auth);
router.get('/summary', asyncHandler(ctrl.summary));
router.get('/mine', asyncHandler(ctrl.mine));
router.post('/', asyncHandler(ctrl.create));

module.exports = router;
