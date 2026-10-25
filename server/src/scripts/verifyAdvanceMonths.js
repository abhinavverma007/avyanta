// READ-ONLY check that every existing approved advance is deducted from the month
// it always was. Writes nothing. Run it against production before and after
// deploying the same-month advance rule:
//   npm run verify:advance-months
//
// For each approved advance it works out the month the advance belongs to
// (the month after `requestedDate` for older advances, its stored `deductMonth`
// for new ones — see utils/advanceMonth.js), then asks the real salary code for
// every month those advances touch and confirms each employee's deduction equals
// the sum of the advances that belong to that month. A mismatch means money would
// have moved between months.
require('dotenv').config();
const mongoose = require('mongoose');
const SalaryAdvance = require('../models/SalaryAdvance');
const salary = require('../controllers/salary.controller');
const { deductMonthOf } = require('../utils/advanceMonth');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`db "${mongoose.connection.name}" @ ${mongoose.connection.host} (read-only)`);

  const approved = await SalaryAdvance.find({ status: 'approved' }).lean();
  const legacy = approved.filter((a) => !a.deductMonth).length;
  console.log(`approved advances: ${approved.length} (older, month-after rule: ${legacy}; new, same-month rule: ${approved.length - legacy})`);
  if (approved.length === 0) {
    console.log('nothing to check');
    await mongoose.disconnect();
    return;
  }

  // Every month an advance could land in under either rule — so a wrongly
  // moved advance shows up in the month it moved to AND the month it left.
  const months = new Set();
  for (const a of approved) {
    months.add(a.requestedDate.slice(0, 7));
    months.add(deductMonthOf(a));
  }

  let compared = 0;
  let mismatches = 0;
  for (const ym of [...months].sort()) {
    const [y, m] = ym.split('-').map(Number);
    const expected = new Map();
    for (const a of approved) {
      if (deductMonthOf(a) === ym) expected.set(String(a.employee), (expected.get(String(a.employee)) || 0) + a.amount);
    }
    let rows;
    await salary.summary({ query: { year: String(y), month: String(m) } }, { json: (b) => { rows = b.rows; } });
    for (const row of rows) {
      const want = Math.round((expected.get(row.employeeId) || 0) * 100) / 100;
      compared++;
      if (row.advanceDeduction !== want) {
        mismatches++;
        console.log(`MISMATCH ${ym} ${row.name} (${row.employeeCode}): salary code deducts ${row.advanceDeduction}, advances say ${want}`);
      }
    }
  }
  console.log(`${compared} employee-month figures across ${months.size} month(s): ${mismatches === 0 ? 'ALL MATCH — nothing moved between months' : `${mismatches} DIFFER — do not ship`}`);
  await mongoose.disconnect();
  process.exit(mismatches === 0 ? 0 : 1);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
