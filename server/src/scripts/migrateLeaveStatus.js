// One-time backfill for the leave-approval workflow. Leave records created
// before this feature existed have no `status` field in the database (they
// were auto-approved by construction). Mongoose's schema default silently
// fills these in as 'pending' the moment the app reads them — so without
// this migration, every pre-existing leave day would suddenly show up as
// "awaiting approval" and get excluded from that month's working-day count,
// changing past salary numbers. Safe to run more than once — it only
// touches documents missing the field in the raw stored document.
require('dotenv').config();
const mongoose = require('mongoose');
const Leave = require('../models/Leave');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await Leave.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'approved', reviewNote: 'Auto-approved (pre-approval-workflow record)' } },
  );
  console.log(`Backfilled ${result.modifiedCount} legacy leave record(s) to status='approved'.`);
  await mongoose.disconnect();
})();
