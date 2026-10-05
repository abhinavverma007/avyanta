const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { runBackfill } = require('../utils/backfillReviewedBy');

// TEMPORARY — deliberately unauthenticated, for a single one-off Postman run.
// DELETE this file and its mount in routes/index.js (and utils/
// backfillReviewedBy.js if unused) in the next deployment after the backfill
// has been run.
const router = express.Router();

router.post(
  '/backfill-reviewed-by',
  asyncHandler(async (req, res) => {
    const apply = req.body?.apply === true; // anything else is a dry run
    const results = await runBackfill({ apply });
    res.json({ mode: apply ? 'applied' : 'dry-run', results });
  }),
);

module.exports = router;
