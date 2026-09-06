const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/adminRole.controller');

// Deliberately strict adminAuth only, never requirePermission, never
// mounted under /team/* — role management is one of the hard invariants
// that's never delegable (see requirePermission.js's doc comment).
const router = express.Router();

router.use(adminAuth);
router.get('/', asyncHandler(ctrl.list));
router.post('/', asyncHandler(ctrl.create));
router.patch('/:id', asyncHandler(ctrl.update));
router.delete('/:id', asyncHandler(ctrl.remove));

module.exports = router;
