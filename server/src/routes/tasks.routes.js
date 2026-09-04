const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/task.controller');

const router = express.Router();

router.use(auth);
router.get('/today', asyncHandler(ctrl.today));

module.exports = router;
