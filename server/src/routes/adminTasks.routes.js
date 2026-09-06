const express = require('express');
const requirePermission = require('../middleware/requirePermission');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/adminTask.controller');

// Mounted at both /admin/tasks (true admin) and /team/tasks (permission-
// delegated employee) — requirePermission grants either transparently.
const router = express.Router();

router.use(requirePermission('tasks'));
router.get('/', asyncHandler(ctrl.list));
router.post('/', asyncHandler(ctrl.create));
router.delete('/:id', asyncHandler(ctrl.remove));

module.exports = router;
