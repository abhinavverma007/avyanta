const Employee = require('../models/Employee');
const Reimbursement = require('../models/Reimbursement');
const { computeMonthlyAttendance } = require('../utils/attendanceStats');
const { istNow } = require('../utils/istDate');

const round2 = (n) => Math.round(n * 100) / 100;

function monthRange(year, month) {
  const pad = (n) => String(n).padStart(2, '0');
  const daysInMonth = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(daysInMonth)}`,
  };
}

async function computeSalary(employee, year, month) {
  const attendance = await computeMonthlyAttendance(employee, year, month);
  const baseSalary = employee.salaryMonthly || 0;
  const perDaySalary = attendance.totalWorkingDays > 0 ? baseSalary / attendance.totalWorkingDays : 0;

  // Leave requests are capped at the monthly quota when they're taken (see
  // leave.controller.js), so every day marked 'leave' is already paid by
  // construction — only genuine absences (no punch, no leave record) cost pay.
  const paidLeavesPerMonth = employee.paidLeavesPerMonth || 0;
  const deduction = round2(attendance.absentDays * perDaySalary);

  const { start, end } = monthRange(year, month);
  const reimbursements = await Reimbursement.find({
    employee: employee._id,
    status: 'approved',
    date: { $gte: start, $lte: end },
  });
  const reimbursementTotal = round2(reimbursements.reduce((sum, r) => sum + r.amount, 0));

  const payable = round2(baseSalary - deduction + reimbursementTotal);

  return {
    employeeId: employee._id.toString(),
    name: employee.name,
    employeeCode: employee.employeeId,
    department: employee.department,
    year,
    month,
    baseSalary,
    totalWorkingDays: attendance.totalWorkingDays,
    presentDays: attendance.presentDays,
    absentDays: attendance.absentDays,
    paidLeavesPerMonth,
    leavesTaken: attendance.leaveDays,
    perDaySalary: round2(perDaySalary),
    deduction,
    reimbursementTotal,
    reimbursementCount: reimbursements.length,
    payable,
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
    totalPayable: round2(rows.reduce((sum, r) => sum + r.payable, 0)),
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

  res.json({
    ...salary,
    reimbursements: reimbursements.map((r) => ({
      id: r._id.toString(),
      category: r.category,
      amount: r.amount,
      description: r.description,
      date: r.date,
    })),
  });
};
