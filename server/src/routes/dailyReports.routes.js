const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/dailyReport.controller');

// Employee-facing: an employee's own end-of-day work report. Never takes an
// employee id — it always acts on the signed-in employee.
const router = express.Router();

router.use(auth);
router.get('/pending', asyncHandler(ctrl.pending)); // before '/:date'
router.get('/:date', asyncHandler(ctrl.getOne));
router.put('/:date', asyncHandler(ctrl.submit));

module.exports = router;
