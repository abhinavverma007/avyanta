const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/salary.controller');

// Employee-facing, read-only view of the caller's OWN salary — mounted at
// /salary (never /admin/* or /team/*). Deliberately a single route with no
// :employeeId param at all, so there's no way to even attempt fetching
// someone else's breakdown; contrast adminSalary.routes.js, which is
// owner-only and takes an arbitrary employeeId.
const router = express.Router();

router.get('/', auth, asyncHandler(ctrl.mySalary));

module.exports = router;
