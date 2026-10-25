// The logic behind scripts/moveAdvancesToSameMonth.js and the one-off
// /maintenance/advances-same-month route — see the script's header for exactly
// which advances move and which are deliberately left alone.
const SalaryAdvance = require('../models/SalaryAdvance');
const Employee = require('../models/Employee');
const { monthAfter } = require('./advanceMonth');
const { istDateString } = require('./istDate');

async function moveAdvancesToSameMonth({ apply = false, today = istDateString() } = {}) {
  const currentMonth = today.slice(0, 7);

  const unstamped = await SalaryAdvance.find({ deductMonth: null }).lean();
  const toMove = [];
  const skippedFuture = [];
  for (const a of unstamped) {
    const requestedMonth = a.requestedDate.slice(0, 7);
    if (monthAfter(a.requestedDate) <= currentMonth) continue; // its (old-rule) month has started or passed — leave it
    if (requestedMonth === currentMonth) toMove.push(a);
    else skippedFuture.push(a); // requested in a month that hasn't begun — shouldn't exist; don't guess
  }

  const names = new Map((await Employee.find({ _id: { $in: toMove.map((a) => a.employee) } }, 'name employeeId').lean()).map((e) => [String(e._id), e]));
  const rows = toMove.map((a) => {
    const e = names.get(String(a.employee));
    return {
      employee: e ? `${e.name} (${e.employeeId})` : String(a.employee),
      amount: a.amount,
      status: a.status,
      requestedDate: a.requestedDate,
      from: monthAfter(a.requestedDate),
      to: currentMonth,
    };
  });

  let moved = 0;
  if (apply && toMove.length > 0) {
    // Guarded on `deductMonth: null` so a concurrent request can never be overwritten.
    const r = await SalaryAdvance.updateMany(
      { _id: { $in: toMove.map((a) => a._id) }, deductMonth: null },
      { $set: { deductMonth: currentMonth } },
    );
    moved = r.modifiedCount ?? 0;
  }

  const approvedTotal = toMove.filter((a) => a.status === 'approved').reduce((s, a) => s + a.amount, 0);
  return {
    month: currentMonth,
    [apply ? 'moved' : 'wouldMove']: apply ? moved : toMove.length,
    approvedAmountMoving: approvedTotal,
    advances: rows,
    skippedFutureDated: skippedFuture.length,
  };
}

module.exports = { moveAdvancesToSameMonth };
