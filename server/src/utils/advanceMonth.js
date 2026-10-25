// Which salary month an advance is deducted from.
//
// Two rules exist side by side, because advances approved under the old rule
// must not move when the new one ships:
//  - NEW advances store `deductMonth` ('YYYY-MM') when they're requested, and it
//    is the month they were requested in — the advance comes out of the same
//    month's salary.
//  - OLD advances (requested before that, so no `deductMonth` stored) keep the
//    original rule: the month right after `requestedDate`. They were promised
//    "next month's salary", months may already be paid against that, and
//    re-pointing them would silently shift real money between months.

function pad(n) {
  return String(n).padStart(2, '0');
}

// 'YYYY-MM' of the month after the one `yyyyMmDd` falls in.
function monthAfter(yyyyMmDd) {
  const [y, m] = String(yyyyMmDd).split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
}

function deductMonthOf(advance) {
  return advance.deductMonth || monthAfter(advance.requestedDate);
}

// "October 2026" — for audit lines and messages.
function monthLabel(yyyyMm) {
  const [y, m] = yyyyMm.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

module.exports = { monthAfter, deductMonthOf, monthLabel };
