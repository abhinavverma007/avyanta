const DailyReport = require('../models/DailyReport');
const { WORK_TYPES, PROBLEMS } = DailyReport;
const Task = require('../models/Task');
const Attendance = require('../models/Attendance');
const { istDateString } = require('../utils/istDate');
const { summarizeSessions } = require('../utils/attendanceStats');
const { recordAudit } = require('../utils/audit');
const { notifyAdmin } = require('../utils/notify');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// A report belongs to one calendar day (IST) and can be written and changed
// freely through that day — and not after it ends. Once midnight passes the
// day's report is locked, so history can't be rewritten.
function checkDate(date) {
  const today = istDateString();
  if (!DATE_RE.test(date)) return { today, error: 'date must be in YYYY-MM-DD format.' };
  if (date < today) return { today, error: 'That day has ended, so its report can no longer be filled in or changed.' };
  if (date > today) return { today, error: 'You can only report on today.' };
  return { today };
}

function sanitize(r) {
  const emp = r.employee && r.employee._id ? { id: r.employee._id.toString(), name: r.employee.name, employeeId: r.employee.employeeId } : null;
  return {
    id: r._id.toString(),
    date: r.date,
    employee: emp,
    jobs: (r.jobs || []).map((j) => ({ taskId: String(j.task), title: j.title, site: j.site })),
    workTypes: r.workTypes || [],
    problems: r.problems || [],
    problemNote: r.problemNote || '',
    safetyIncident: !!r.safetyIncident,
    safetyNote: r.safetyNote || '',
    messageToOwner: r.messageToOwner || '',
    hoursWorked: r.hoursWorked ?? null,
    punchedInAt: r.punchedInAt || null,
    punchedOutAt: r.punchedOutAt || null,
    flagged: !!r.flagged,
    submittedAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// The jobs this employee was assigned on that date — shown on the form for context
// and linked to the report automatically.
async function assignedTasks(employeeId, date) {
  const tasks = await Task.find({ employees: employeeId, date }).sort({ createdAt: 1 }).lean();
  return tasks.map((t) => ({ id: t._id.toString(), title: t.title, site: t.site || '', status: t.status || 'pending' }));
}

// GET /daily-reports/pending — whether the employee has worked today but hasn't
// reported yet; drives the dashboard reminder. Only today: once the day ends
// its report is locked, so there's nothing left to remind about.
exports.pending = async (req, res) => {
  const today = istDateString();
  const [attendance, report] = await Promise.all([
    Attendance.findOne({ employee: req.employee._id, date: today }, 'date').lean(),
    DailyReport.findOne({ employee: req.employee._id, date: today }, 'date').lean(),
  ]);
  res.json({ dates: attendance && !report ? [today] : [] });
};

// GET /daily-reports/:date — the report if one exists, plus that day's assigned jobs.
exports.getOne = async (req, res) => {
  // 'today' lets the app ask for the server's (IST) today without trusting the device clock.
  const date = req.params.date === 'today' ? istDateString() : req.params.date;
  const { today, error } = checkDate(date);
  if (error) return res.status(400).json({ message: error });
  const [report, tasks, attendance] = await Promise.all([
    DailyReport.findOne({ employee: req.employee._id, date }).lean(),
    assignedTasks(req.employee._id, date),
    Attendance.findOne({ employee: req.employee._id, date }, 'date').lean(),
  ]);
  res.json({
    date,
    isToday: date === today,
    punchedIn: !!attendance,
    tasks,
    report: report ? sanitize(report) : null,
  });
};

function cleanText(v, max = 500) {
  return String(v ?? '').trim().slice(0, max);
}

// PUT /daily-reports/:date — create the day's report, or edit it if it exists.
// Open all day (today only); locked once the day ends — see checkDate().
exports.submit = async (req, res) => {
  const { date } = req.params;
  const { error } = checkDate(date);
  if (error) return res.status(400).json({ message: error });

  const employee = req.employee;
  const attendance = await Attendance.findOne({ employee: employee._id, date });
  if (!attendance) {
    return res.status(409).json({ message: `You have no attendance for ${date}, so there's nothing to report.` });
  }

  const body = req.body || {};

  // The jobs they were assigned that day are linked automatically — the form
  // doesn't ask which job; it's the same question as "what work did you do".
  const assigned = await Task.find({ employees: employee._id, date }).sort({ createdAt: 1 }).lean();
  const jobs = assigned.map((t) => ({ task: t._id, title: t.title, site: t.site || '' }));

  const workTypes = [...new Set(Array.isArray(body.workTypes) ? body.workTypes : [])];
  if (workTypes.length === 0) return res.status(400).json({ message: 'Select at least one kind of work you did.' });
  if (!workTypes.every((w) => WORK_TYPES.includes(w))) return res.status(400).json({ message: 'Unknown kind of work selected.' });

  const problems = [...new Set(Array.isArray(body.problems) ? body.problems : [])];
  if (problems.length === 0) return res.status(400).json({ message: 'Tell us about any problem, or choose "no problem".' });
  if (!problems.every((p) => PROBLEMS.includes(p))) return res.status(400).json({ message: 'Unknown problem selected.' });
  if (problems.includes('none') && problems.length > 1) {
    return res.status(400).json({ message: '"No problem" can\'t be combined with a problem.' });
  }

  if (typeof body.safetyIncident !== 'boolean') {
    return res.status(400).json({ message: 'Tell us whether there was any injury or safety incident.' });
  }
  const safetyNote = cleanText(body.safetyNote);
  if (body.safetyIncident && !safetyNote) {
    return res.status(400).json({ message: 'Describe what happened in the safety incident.' });
  }

  const { workHours, firstPunchIn, lastPunchOut } = summarizeSessions(attendance.sessions);
  const flagged = !problems.includes('none') || body.safetyIncident;
  const before = await DailyReport.findOne({ employee: employee._id, date }, 'flagged').lean();

  const fields = {
    jobs,
    workTypes,
    problems,
    problemNote: problems.includes('none') ? '' : cleanText(body.problemNote),
    safetyIncident: body.safetyIncident,
    safetyNote: body.safetyIncident ? safetyNote : '',
    messageToOwner: cleanText(body.messageToOwner, 1000),
    hoursWorked: workHours,
    punchedInAt: firstPunchIn,
    punchedOutAt: lastPunchOut,
    flagged,
  };

  const saved = await DailyReport.findOneAndUpdate({ employee: employee._id, date }, { $set: fields }, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  }).populate('employee', 'name employeeId');

  await recordAudit(req, {
    action: 'dailyreport.submit',
    resourceType: 'DailyReport',
    resourceId: saved._id,
    summary: `${employee.name} ${before ? 'updated' : 'submitted'} the work report for ${date}`,
    metadata: { date, flagged },
  });

  // The owner hears about every report — the first submission and each later
  // update — instead of having to open the page to find out. A report that newly
  // needs attention (a problem or a safety incident) gets the stronger alert
  // instead of the plain one, so it never produces two. Reports are the owner's
  // alone, so only the owner is told. Not awaited — see the note in notify.js.
  const link = `/superadmin/daily-reports?date=${date}`;
  if (flagged && !before?.flagged) {
    notifyAdmin({
      type: 'dailyreport.flagged',
      title: `${employee.name} reported ${body.safetyIncident ? 'a safety incident' : 'a problem'} on ${date}`,
      body: body.safetyIncident ? safetyNote : fields.problemNote,
      link: `${link}&flagged=1`,
    });
  } else {
    notifyAdmin({
      type: before ? 'dailyreport.updated' : 'dailyreport.submitted',
      title: `${employee.name} ${before ? 'updated' : 'submitted'} the work report for ${date}`,
      body: fields.messageToOwner,
      link,
    });
  }

  res.status(before ? 200 : 201).json({ report: sanitize(saved) });
};

exports.sanitize = sanitize;
