const Employee = require('../models/Employee');
const Reimbursement = require('../models/Reimbursement');
const Payout = require('../models/Payout');
const { computeMonthlyAttendance } = require('../utils/attendanceStats');
const { istNow, istDateString } = require('../utils/istDate');

const round2 = (n) => Math.round(n * 100) / 100;

function monthRange(year, month) {
  const pad = (n) => String(n).padStart(2, '0');
  const daysInMonth = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(daysInMonth)}`,
  };
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
  const presentDays = elapsedDays.filter((d) => d.status === 'present').length;
  const absentDays = elapsedDays.filter((d) => d.status === 'absent').length;
  const leavesTaken = elapsedDays.filter((d) => d.status === 'leave').length;
  const paidDays = presentDays + leavesTaken;
  const unpaidDays = elapsedDays.length - paidDays; // absent + pending (unapproved) leave, dated so far

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

  const payable = round2(earnedTillDate + reimbursementTotal);

  // What's actually been paid out for this employee+month so far, vs. what
  // the numbers currently say is owed — a recorded fact, not recomputed.
  // Balance nets the two, so a late correction after payment shows up as a
  // small top-up owed, not the full amount demanded again from scratch.
  const payouts = await Payout.find({ employee: employee._id, year, month }).sort({ paidAt: 1 });
  const paidAmount = round2(payouts.reduce((sum, p) => sum + p.amount, 0));
  const balance = round2(payable - paidAmount);
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
    payable,
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

exports.detail = async (req, res) => {
  const { year, month } = resolveYearMonth(req);
  const employee = await Employee.findById(req.params.employeeId);
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });

  const salary = await computeSalary(employee, year, month);
  const { start, end } = monthRange(year, month);
  const reimbursements = await Reimbursement.find({
    employee: employee._id,
    status: 'approved',
    date: { $gte: start, $lte: end },
  }).sort({ date: 1 });
  const payouts = await Payout.find({ employee: employee._id, year, month }).sort({ paidAt: 1 });

  res.json({
    ...salary,
    reimbursements: reimbursements.map((r) => ({
      id: r._id.toString(),
      category: r.category,
      amount: r.amount,
      description: r.description,
      date: r.date,
    })),
    payouts: payouts.map((p) => ({
      id: p._id.toString(),
      amount: p.amount,
      paidAt: p.paidAt,
      note: p.note,
    })),
  });
};

// Records that the owner paid `amount` to this employee for this month —
// a fact, not a recomputation. Doesn't touch `payable`; the next read nets
// this against the live payable to produce `balance`. Rejects an amount
// that doesn't leave a sane non-negative balance so a slipped decimal
// point or duplicate click can't silently overpay on record.
exports.recordPayout = async (req, res) => {
  const { year, month, amount, note } = req.body;
  const employee = await Employee.findById(req.params.employeeId);
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });

  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  if (!y || !m || m < 1 || m > 12) {
    return res.status(400).json({ message: 'A valid year and month are required.' });
  }
  const amt = Number(amount);
  if (!amt || amt <= 0) {
    return res.status(400).json({ message: 'Amount must be greater than 0.' });
  }

  const salary = await computeSalary(employee, y, m);
  if (round2(amt - salary.balance) > 0.01) {
    return res.status(409).json({
      message: `Only ₹${salary.balance} is currently owed for this month — can't record a payout larger than that.`,
    });
  }

  const payout = await Payout.create({
    employee: employee._id,
    year: y,
    month: m,
    amount: amt,
    paidAt: new Date(),
    note: note || '',
  });

  const updated = await computeSalary(employee, y, m);
  res.status(201).json({ payout: { id: payout._id.toString(), amount: payout.amount, paidAt: payout.paidAt, note: payout.note }, salary: updated });
};
