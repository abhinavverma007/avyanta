const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/notification.controller');

// Employee-facing — every plain employee AND delegated Supervisor/Manager
// session reads from here (a delegated manager's own "you have a request to
// review" notifications are stored the same way, addressed to their
// employee id — see notify.js). Never /admin/* or /team/*: same controller,
// scoped to req.employee._id server-side.
const router = express.Router();

router.get('/', auth, asyncHandler(ctrl.list));
router.patch('/:id/read', auth, asyncHandler(ctrl.markRead));
router.patch('/read-all', auth, asyncHandler(ctrl.markAllRead));

module.exports = router;
