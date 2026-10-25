// One-time move of advances that are still waiting to come out of NEXT month back
// into the month they were requested in — so they match the same-month rule the
// app uses from now on (see utils/advanceMonth.js).
//
// Which advances: ones with no stored `deductMonth` (requested before the
// same-month rule) AND requested in the CURRENT month — under the old rule those
// would come out of next month. They get `deductMonth` = their own month, so they
// show up in this month's salary and next month no longer carries them.
// Pending ones too, so they behave the same when approved later.
//
// Deliberately NOT touched: older advances whose month has already started or
// passed (requested in earlier months). Those months may already be paid out, so
// moving them would silently change balances that were settled.
//
// Safe to re-run — it only ever touches advances that still have no `deductMonth`.
// Dry run by default (prints what it WOULD change); pass --apply to write:
//   npm run migrate:advances-same-month            # preview
//   npm run migrate:advances-same-month -- --apply # write
require('dotenv').config();
const mongoose = require('mongoose');
const { moveAdvancesToSameMonth } = require('../utils/moveAdvancesToSameMonth');

module.exports = { moveAdvancesToSameMonth };

if (require.main === module) {
  (async () => {
    const apply = process.argv.includes('--apply');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`${apply ? 'APPLYING' : 'DRY RUN (no changes)'} on db "${mongoose.connection.name}" @ ${mongoose.connection.host}`);
    const result = await moveAdvancesToSameMonth({ apply });
    console.log(JSON.stringify(result, null, 2));
    if (!apply && result.wouldMove > 0) console.log('\nRe-run with --apply to write this. Save this output — it is your record of what moved.');
    await mongoose.disconnect();
  })().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
