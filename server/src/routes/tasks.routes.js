const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/task.controller');

const router = express.Router();

router.use(auth);
router.get('/mine', asyncHandler(ctrl.mine));

module.exports = router;
