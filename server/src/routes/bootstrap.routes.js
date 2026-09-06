// TEMPORARY — see bootstrap.controller.js. No auth middleware at all,
// deliberately, for one-time Postman use right after a deploy. Remove this
// file and its mount in routes/index.js once production is migrated.
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/bootstrap.controller');

const router = express.Router();

router.post('/rbac-migration', asyncHandler(ctrl.run));

module.exports = router;
