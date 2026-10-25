const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { runBackfill } = require('../utils/backfillReviewedBy');
const { moveAdvancesToSameMonth } = require('../utils/moveAdvancesToSameMonth');

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

// TEMPORARY — deliberately unauthenticated, for one Postman run after the
// same-month advance rule is deployed. An empty body is only a PREVIEW; it writes
// nothing unless the body is exactly {"apply": true}. Idempotent: running it
// again moves nothing. DELETE this route (and utils/moveAdvancesToSameMonth.js
// if unused) once it has been run.
router.post(
  '/advances-same-month',
  asyncHandler(async (req, res) => {
    const apply = req.body?.apply === true; // anything else is a dry run
    const result = await moveAdvancesToSameMonth({ apply });
    // No audit actor exists for an unauthenticated call, so keep a record in the server log.
    if (apply) console.log('[maintenance] advances-same-month applied:', JSON.stringify(result));
    res.json({ mode: apply ? 'applied' : 'dry-run', ...result });
  }),
);

module.exports = router;
