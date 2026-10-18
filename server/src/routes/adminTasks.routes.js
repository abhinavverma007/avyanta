const express = require('express');
const requirePermission = require('../middleware/requirePermission');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/adminTask.controller');
const clientCtrl = require('../controllers/adminClient.controller');

// Mounted at both /admin/tasks (true admin) and /team/tasks (permission-
// delegated employee) — requirePermission grants either transparently.
const router = express.Router();

router.use(requirePermission('tasks'));
router.get('/', asyncHandler(ctrl.list));
// Read-only client list for the Assign Task dropdown — declared before '/:id' so 'clients' isn't read as a task id.
router.get('/clients', asyncHandler(clientCtrl.listForTasks));
router.get('/:id', asyncHandler(ctrl.getOne));
router.post('/', asyncHandler(ctrl.create));
router.patch('/:id', asyncHandler(ctrl.update));
router.delete('/:id', asyncHandler(ctrl.remove));

module.exports = router;
