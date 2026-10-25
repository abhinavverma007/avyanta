const Employee = require('../models/Employee');
const Reimbursement = require('../models/Reimbursement');
const SalaryAdvance = require('../models/SalaryAdvance');
const Payout = require('../models/Payout');
const { computeMonthlyAttendance, fractionOf } = require('../utils/attendanceStats');
const { istNow, istDateString } = require('../utils/istDate');
const { recordAudit } = require('../utils/audit');
const { notifyEmployee } = require('../utils/notify');

const round2 = (n) => Math.round(n * 100) / 100;

function monthRange(year, month) {
  const pad = (n) => String(n).padStart(2, '0');
  const daysInMonth = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(daysInMonth)}`,
  };
}

function prevMonthOf(year, month) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

// A month's payable is reduced by the approved advances that belong to that
// month (see utils/advanceMonth.js for the two rules):
//  - advances with a stored `deductMonth` come out of exactly that month — the
//    month they were requested in;
//  - older advances (no `deductMonth`) keep the original rule and come out of the
//    month right after `requestedDate`, i.e. they're the ones requested in the
//    *previous* calendar month. Nothing already approved moves.
// Approved late (after the target month has already passed)? It still applies
// retroactively to that same month — the balance simply nets it against
// whatever was already paid, same as a late-approved leave/regularization would.
async function advanceDeductionFor(employeeId, year, month) {
  const { year: py, month: pm } = prevMonthOf(year, month);
  const { start, end } = monthRange(py, pm);
  const advances = await SalaryAdvance.find({
    employee: employeeId,
    status: 'approved',
    $or: [
      { deductMonth: `${year}-${String(month).padStart(2, '0')}` },
      { deductMonth: null, requestedDate: { $gte: start, $lte: end } }, // legacy: no deductMonth stored
    ],
  });
  return { advances, total: round2(advances.reduce((sum, a) => sum + a.amount, 0)) };
}

// Salary is computed "till date": for the current month, only days up to
// today count at all (future days are neither paid nor deducted); a past
// month naturally includes every day since none of it is 'future' anymore.
// The daily rate is always baseSalary / calendar-days-in-month — a flat
// company-wide rate, not something that shrinks as the month progresses.
// Present and approved-leave days are paid; absent and not-yet-approved
// (pending) leave days are not — a pending request only starts costing the
// employee money once the superadmin actually reviews and rejects it, or
// costs them nothing once approved, but sits withholding pay while pending.
async function computeSalary(employee, year, month) {
  const attendance = await computeMonthlyAttendance(employee, year, month);
  const baseSalary = employee.salaryMonthly || 0;
  const perDaySalary = attendance.calendarDaysInMonth > 0 ? baseSalary / attendance.calendarDaysInMonth : 0;

  // computeMonthlyAttendance deliberately labels a future-dated *approved*
  // leave as 'leave' rather than 'future', so the attendance calendar can
  // show it ahead of time — but for "till date" salary that's wrong, a leave
  // day next week hasn't happened yet and can't be paid or deducted today.
  // Bound "elapsed" by the actual calendar date, not the status label.
  const todayStr = istDateString();
  const elapsedDays = attendance.days.filter((d) => d.date <= todayStr);
  // A partial day (the owner marked it e.g. 62%) pays that share and the rest
  // is unpaid, so present counts fractionally and its remainder counts as absent.
  const presentList = elapsedDays.filter((d) => d.status === 'present');
  const presentDays = round2(presentList.reduce((sum, d) => sum + fractionOf(d), 0));
  const absentDays = round2(
    elapsedDays.filter((d) => d.status === 'absent').length + presentList.reduce((sum, d) => sum + (1 - fractionOf(d)), 0),
  );
  const leavesTaken = elapsedDays.filter((d) => d.status === 'leave').length;
  const paidDays = presentDays + leavesTaken;
  const unpaidDays = elapsedDays.length - paidDays; // absent + unpaid part of partial days + pending (unapproved) leave, dated so far

  const paidLeavesPerMonth = employee.paidLeavesPerMonth || 0;
  const deduction = round2(unpaidDays * perDaySalary);
  const earnedTillDate = round2(paidDays * perDaySalary);

  const { start, end } = monthRange(year, month);
  const reimbursements = await Reimbursement.find({
    employee: employee._id,
    status: 'approved',
    date: { $gte: start, $lte: end },
  });
  const reimbursementTotal = round2(reimbursements.reduce((sum, r) => sum + r.amount, 0));

  const { total: advanceDeduction, advances } = await advanceDeductionFor(employee._id, year, month);

  const payable = round2(earnedTillDate + reimbursementTotal - advanceDeduction);

  // What's actually been paid out for this employee+month so far, vs. what
  // the numbers currently say is owed — a recorded fact, not recomputed.
  // Balance nets the two, so a late correction after payment shows up as a
  // small top-up owed, not the full amount demanded again from scratch.
  const payouts = await Payout.find({ employee: employee._id, year, month }).sort({ paidAt: 1 });
  const paidAmount = round2(payouts.reduce((sum, p) => sum + p.amount, 0));

  // Carry-over, like an EMI. When the owner pays a custom amount, what's left over
  // (or paid extra) is stored on that payout and flows into the next month:
  //  - carriedIn: what the PREVIOUS month carried into this one;
  //  - carriedOut: what THIS month's payouts carried on to the next.
  // Months where the owner only used "Pay Now" / "Mark as paid" carry nothing, so
  // carriedIn/Out are 0 and balance is exactly what it always was.
  const { year: cpy, month: cpm } = prevMonthOf(year, month);
  const carriedInPayouts = await Payout.find({
    employee: employee._id,
    year: cpy,
    month: cpm,
    carryForward: { $exists: true, $ne: 0 },
  });
  const carriedIn = round2(carriedInPayouts.reduce((sum, p) => sum + p.carryForward, 0));
  const carriedOut = round2(payouts.reduce((sum, p) => sum + (p.carryForward || 0), 0));
  const balance = round2(payable + carriedIn - paidAmount - carriedOut);
  const lastPaidAt = payouts.length > 0 ? payouts[payouts.length - 1].paidAt : null;

  return {
    employeeId: employee._id.toString(),
    name: employee.name,
    employeeCode: employee.employeeId,
    department: employee.department,
    upiId: employee.upiId || '',
    year,
    month,
    baseSalary,
    calendarDaysInMonth: attendance.calendarDaysInMonth,
    elapsedDays: elapsedDays.length,
    presentDays,
    absentDays,
    pendingLeaveDays: attendance.pendingLeaveDays,
    paidLeavesPerMonth,
    leavesTaken,
    perDaySalary: round2(perDaySalary),
    deduction,
    earnedTillDate,
    reimbursementTotal,
    reimbursementCount: reimbursements.length,
    advanceDeduction,
    advanceCount: advances.length,
    payable,
    carriedIn,
    carriedOut,
    paidAmount,
    balance,
    lastPaidAt,
  };
}

function resolveYearMonth(req) {
  const now = istNow();
  const year = parseInt(req.query.year, 10) || now.getUTCFullYear();
  const month = parseInt(req.query.month, 10) || now.getUTCMonth() + 1;
  return { year, month };
}

exports.summary = async (req, res) => {
  const { year, month } = resolveYearMonth(req);
  const employees = await Employee.find({ isActive: true });
  const rows = await Promise.all(employees.map((e) => computeSalary(e, year, month)));

  res.json({
    year,
    month,
    rows,
    totalBalance: round2(rows.reduce((sum, r) => sum + r.balance, 0)),
  });
};

// Shared by the owner's detail() below and the employee-facing mySalary()
// in salary.self.routes.js — same breakdown either way, the only
// difference is which employee document the caller is allowed to pass in.
async function buildDetail(employee, year, month) {
  const salary = await computeSalary(employee, year, month);
  const { start, end } = monthRange(year, month);
  const reimbursements = await Reimbursement.find({
    employee: employee._id,
    status: 'approved',
    date: { $gte: start, $lte: end },
  }).sort({ date: 1 });
  const payouts = await Payout.find({ employee: employee._id, year, month }).sort({ paidAt: 1 });
  const { advances } = await advanceDeductionFor(employee._id, year, month);

  return {
    ...salary,
    reimbursements: reimbursements.map((r) => ({
      id: r._id.toString(),
      category: r.category,
      amount: r.amount,
      description: r.description,
      date: r.date,
    })),
    advances: advances.map((a) => ({
      id: a._id.toString(),
      amount: a.amount,
      reason: a.reason,
      requestedDate: a.requestedDate,
    })),
    payouts: payouts.map((p) => ({
      id: p._id.toString(),
      amount: p.amount,
      paidAt: p.paidAt,
      note: p.note,
      carryForward: p.carryForward || 0,
    })),
  };
}

exports.detail = async (req, res) => {
  const { year, month } = resolveYearMonth(req);
  const employee = await Employee.findById(req.params.employeeId);
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });

  res.json(await buildDetail(employee, year, month));
};

// Employee-facing, read-only — never takes an :employeeId param, so it's
// structurally impossible to fetch anyone else's breakdown (see
// salary.self.routes.js). No payout-recording endpoint exists on this path;
// that stays owner-only.
exports.mySalary = async (req, res) => {
  const { year, month } = resolveYearMonth(req);
  res.json(await buildDetail(req.employee, year, month));
};

// Records that the owner paid `amount` to this employee for this month —
// a fact, not a recomputation. Doesn't touch `payable`; the next read nets
// this against the live payable to produce `balance`.
//
// Two modes:
//  - the normal one (no `carryOver`): unchanged — the amount must be greater than 0
//    and can't exceed what's currently owed, so a slipped decimal point or duplicate
//    click can't silently overpay on record;
//  - `carryOver: true` (the owner typed a custom amount): any amount from 0 up, and
//    whatever differs from the balance is carried into NEXT month — paid less leaves
//    a surplus still owed, paid more leaves a negative to be recovered — like an EMI.
//    It has to be asked for explicitly, so an older page that only sends `amount`
//    still can't overpay.
exports.recordPayout = async (req, res) => {
  const { year, month, amount, note } = req.body;
  const carryOver = req.body.carryOver === true;
  const employee = await Employee.findById(req.params.employeeId);
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });

  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  if (!y || !m || m < 1 || m > 12) {
    return res.status(400).json({ message: 'A valid year and month are required.' });
  }
  const amt = round2(Number(amount));

  const salary = await computeSalary(employee, y, m);
  let carryForward = 0;
  if (carryOver) {
    if (!Number.isFinite(amt) || amt < 0 || amt > 10000000) {
      return res.status(400).json({ message: 'Enter a valid amount (0 or more).' });
    }
    carryForward = round2(salary.balance - amt);
    if (amt === 0 && carryForward === 0) {
      return res.status(400).json({ message: 'There is nothing to record for this month.' });
    }
  } else {
    if (!amt || amt <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0.' });
    }
    if (round2(amt - salary.balance) > 0.01) {
      return res.status(409).json({
        message: `Only ₹${salary.balance} is currently owed for this month — can't record a payout larger than that.`,
      });
    }
  }

  const payout = await Payout.create({
    employee: employee._id,
    year: y,
    month: m,
    amount: amt,
    paidAt: new Date(),
    note: note || '',
    ...(carryForward !== 0 ? { carryForward } : {}),
  });

  await recordAudit(req, {
    action: 'salary.payout_recorded',
    resourceType: 'Payout',
    resourceId: payout._id,
    summary: `Recorded ₹${amt} payout to ${employee.name} for ${m}/${y}${carryForward > 0 ? ` — ₹${carryForward} still owed carried to next month` : carryForward < 0 ? ` — ₹${-carryForward} paid extra, to be deducted from next month` : ''}`,
    metadata: { employeeId: employee._id, year: y, month: m, amount: amt, balanceBefore: salary.balance, carryForward },
  });

  // Not awaited — see the note in notify.js.
  const carryText =
    carryForward > 0
      ? `₹${carryForward} of your pay for ${m}/${y} is carried over to next month.`
      : carryForward < 0
        ? `You were paid ₹${-carryForward} extra — it will be deducted from next month's pay.`
        : '';
  notifyEmployee(employee._id, {
    type: 'salary.paid',
    title: amt > 0 ? `₹${amt} recorded as paid` : `Your pay for ${m}/${y} is carried over to next month`,
    body: [note || (carryText ? '' : `For ${m}/${y}`), carryText].filter(Boolean).join(' '),
    link: '/salary',
  });

  const updated = await computeSalary(employee, y, m);
  res.status(201).json({ payout: { id: payout._id.toString(), amount: payout.amount, paidAt: payout.paidAt, note: payout.note, carryForward: payout.carryForward || 0 }, salary: updated });
};
