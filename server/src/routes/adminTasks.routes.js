const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/adminTask.controller');

const router = express.Router();

router.use(adminAuth);
router.get('/', asyncHandler(ctrl.list));
router.post('/', asyncHandler(ctrl.create));
router.delete('/:id', asyncHandler(ctrl.remove));

module.exports = router;
