const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/adminClient.controller');

// Mounted at /admin/clients ONLY — never under /team, so managing the client
// database is strictly the owner's. (Reading the list for the Assign Task
// dropdown goes through GET /tasks/clients instead, which a Supervisor with
// the Tasks permission can reach.)
const router = express.Router();

router.use(adminAuth);
router.get('/', asyncHandler(ctrl.list));
router.post('/', asyncHandler(ctrl.create));
router.get('/:id/history', asyncHandler(ctrl.history));
router.patch('/:id', asyncHandler(ctrl.update));
router.delete('/:id', asyncHandler(ctrl.remove));

module.exports = router;
