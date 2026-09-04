const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/adminEmployee.controller');

const router = express.Router();

router.use(adminAuth);
router.get('/', asyncHandler(ctrl.list));
router.get('/preview-email', asyncHandler(ctrl.previewEmail));
router.post('/', asyncHandler(ctrl.create));
router.get('/:id', asyncHandler(ctrl.get));
router.patch('/:id', asyncHandler(ctrl.update));
router.post('/:id/reset-password', asyncHandler(ctrl.resetPassword));

module.exports = router;
