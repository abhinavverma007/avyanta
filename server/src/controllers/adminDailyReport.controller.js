const DailyReport = require('../models/DailyReport');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const { istDateString } = require('../utils/istDate');
const { sanitize } = require('./dailyReport.controller');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// The owner's (or an Assign-Work Supervisor's) view of the day's reports.
exports.list = async (req, res) => {
  const date = req.query.date || istDateString();
  if (!DATE_RE.test(date)) return res.status(400).json({ message: 'date must be in YYYY-MM-DD format.' });

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

  const filter = { date };
  if (req.query.employeeId) filter.employee = req.query.employeeId;
  if (req.query.flagged === 'true' || req.query.flagged === '1') filter.flagged = true;

  const [reports, total, flaggedCount] = await Promise.all([
    DailyReport.find(filter)
      .populate('employee', 'name employeeId')
      .sort({ flagged: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    DailyReport.countDocuments(filter),
    DailyReport.countDocuments({ date, flagged: true }),
  ]);

  res.json({
    date,
    reports: reports.map(sanitize),
    total,
    flaggedCount,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
};

// Who worked that day (has attendance) but hasn't submitted a report yet.
exports.missing = async (req, res) => {
  const date = req.query.date || istDateString();
  if (!DATE_RE.test(date)) return res.status(400).json({ message: 'date must be in YYYY-MM-DD format.' });

  const [attendance, reports] = await Promise.all([
    Attendance.find({ date }, 'employee voided').lean(),
    DailyReport.find({ date }, 'employee').lean(),
  ]);
  const reported = new Set(reports.map((r) => String(r.employee)));
  const missingIds = attendance.map((a) => String(a.employee)).filter((id) => !reported.has(id));
  // For a finished day these are the people the end-of-day check marked absent.
  const markedAbsent = new Set(attendance.filter((a) => a.voided && a.voided.at).map((a) => String(a.employee)));

  const employees = await Employee.find({ _id: { $in: missingIds }, isActive: true }, 'name employeeId').sort({ name: 1 }).lean();
  res.json({
    date,
    employees: employees.map((e) => ({ id: e._id.toString(), name: e.name, employeeId: e.employeeId, markedAbsent: markedAbsent.has(String(e._id)) })),
  });
};
