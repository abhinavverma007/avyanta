// One-time backfill of `reviewedBy` on requests reviewed before that field
// existed (see utils/backfillReviewedBy.js). Safe to re-run.
//
// Dry run by default (prints what it WOULD change); pass --apply to write:
//   npm run backfill:reviewed-by            # preview
//   npm run backfill:reviewed-by -- --apply # write
require('dotenv').config();
const mongoose = require('mongoose');
const { runBackfill } = require('../utils/backfillReviewedBy');

(async () => {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`${apply ? 'APPLYING' : 'DRY RUN (no changes)'} on db "${mongoose.connection.name}" @ ${mongoose.connection.host}`);
  console.log(JSON.stringify(await runBackfill({ apply }), null, 2));
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
