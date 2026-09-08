const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/task.controller');

const router = express.Router();

router.use(auth);
router.get('/mine', asyncHandler(ctrl.mine));
router.patch('/:id/status', asyncHandler(ctrl.updateStatus));
router.post('/:id/notes', asyncHandler(ctrl.addNote));

module.exports = router;
