const Attendance = require('../models/Attendance');
const DailyReport = require('../models/DailyReport');
const Employee = require('../models/Employee');
const DayClose = require('../models/DayClose');
const SystemSetting = require('../models/SystemSetting');
const { istDateString } = require('./istDate');
const { notifyEmployee, notifyEmployees, notifyAdmin } = require('./notify');
const { recordSystemAudit } = require('./audit');

// The rule: an employee who punched in but did not submit that day's daily work report before
// the day ended is marked ABSENT for it — even though they were present. This runs after
// midnight (IST) for each day that has finished.
//
// Built to be safe to run again and again:
//  - it only ever looks at days that have ENDED (never today);
//  - a day is processed once (DayClose), and marking someone is a conditional update, so a
//    restart, a second server copy, or a crash half-way through can't mark or notify anyone twice;
//  - if the server was off at midnight it simply catches up on the days it missed;
//  - it starts counting from a start date (the day AFTER it first runs), so nothing in the past
//    is ever touched and workers get a day's notice.
// Kill switch: set DAILY_REPORT_ENFORCEMENT=off and nothing is marked. DAILY_REPORT_RULE_START
// (YYYY-MM-DD) overrides the start date.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CATCH_UP_DAYS = 62;

function enabled() {
  return String(process.env.DAILY_REPORT_ENFORCEMENT || 'on').trim().toLowerCase() !== 'off';
}

function shiftDay(date, delta) {
  const [y, m, d] = date.split('-').map(Number);
  return istDateString(new Date(Date.UTC(y, m - 1, d + delta)));
}

// Tell everyone, once, that the rule exists and when it starts.
async function announceRule(start) {
  const first = await SystemSetting.findOneAndUpdate(
    { _id: 'dailyReportRuleAnnounced' },
    { $setOnInsert: { value: new Date().toISOString() } },
    { upsert: true, new: false },
  );
  if (first) return false; // already announced earlier
  const employees = await Employee.find({ isActive: true }, '_id').lean();
  await notifyEmployees(employees.map((e) => e._id), {
    type: 'dailyreport.rule',
    title: 'New rule: submit your daily work report every day',
    body: `From ${start}, if you don't submit your daily work report before the day ends, that day will be marked absent — even if you punched in.`,
    link: '/daily-report',
  });
  return true;
}

// The first day the rule applies: the day after it first runs (so there's notice), remembered.
async function resolveRuleStart(today) {
  const fromEnv = process.env.DAILY_REPORT_RULE_START;
  let start;
  if (fromEnv && DATE_RE.test(fromEnv)) {
    start = fromEnv;
  } else {
    const created = await SystemSetting.findOneAndUpdate(
      { _id: 'dailyReportRuleStart' },
      { $setOnInsert: { value: shiftDay(today, 1) } },
      { upsert: true, new: true },
    ).lean();
    start = created.value;
  }
  await announceRule(start);
  return start;
}

// Marks one employee's day absent. Returns false if someone else got there first.
async function voidOne(att, date, now) {
  const r = await Attendance.updateOne(
    { _id: att._id, 'voided.at': { $exists: false }, 'override.at': { $exists: false } },
    { $set: { voided: { at: now, reason: 'no_daily_report' } } },
  );
  if (r.modifiedCount !== 1) return false;

  const emp = await Employee.findById(att.employee, 'name employeeId').lean();
  await notifyEmployee(att.employee, {
    type: 'attendance.voided',
    title: `You were marked absent for ${date}`,
    body: "You didn't submit your daily work report before the day ended, so that day is counted as absent.",
    link: '/attendance',
  });
  await recordSystemAudit({
    action: 'attendance.voided',
    resourceType: 'Attendance',
    resourceId: att._id,
    summary: `${emp ? emp.name : 'An employee'} marked absent for ${date} — no daily work report submitted`,
    metadata: { date, employeeId: att.employee, employeeCode: emp ? emp.employeeId : undefined, reason: 'no_daily_report' },
  });
  return true;
}

// Processes ONE finished day.
async function closeDay(date, { now = new Date() } = {}) {
  const [attendance, reports] = await Promise.all([
    // Real attendance only: not already voided, and not one the owner set by hand (their decision stands).
    Attendance.find({
      date,
      'sessions.0': { $exists: true },
      'voided.at': { $exists: false },
      'override.at': { $exists: false },
    }).lean(),
    DailyReport.find({ date }, 'employee').lean(),
  ]);
  const reported = new Set(reports.map((r) => String(r.employee)));

  const voidedIds = [];
  for (const att of attendance) {
    if (reported.has(String(att.employee))) continue;
    if (await voidOne(att, date, now)) voidedIds.push(att.employee);
  }

  if (voidedIds.length > 0) {
    const emps = await Employee.find({ _id: { $in: voidedIds } }, 'name').sort({ name: 1 }).lean();
    const names = emps.map((e) => e.name);
    await notifyAdmin({
      type: 'attendance.voided_summary',
      title: `${voidedIds.length} employee(s) marked absent for ${date} — no daily report`,
      body: names.slice(0, 10).join(', ') + (names.length > 10 ? ` and ${names.length - 10} more` : ''),
      link: `/superadmin/daily-reports?date=${date}`,
    });
  }

  await DayClose.updateOne(
    { _id: date },
    { $setOnInsert: { processedAt: now, voidedCount: voidedIds.length, employeeIds: voidedIds } },
    { upsert: true },
  );
  return { date, voided: voidedIds.length };
}

// Every finished day from the start date up to yesterday that hasn't been processed yet.
async function processPendingDays({ today = istDateString(), now = new Date() } = {}) {
  if (!enabled()) return { skipped: 'disabled', days: [] };
  const start = await resolveRuleStart(today);
  const yesterday = shiftDay(today, -1);

  const dates = [];
  for (let d = start; d <= yesterday && dates.length < MAX_CATCH_UP_DAYS; d = shiftDay(d, 1)) dates.push(d);
  if (dates.length === 0) return { start, days: [] };

  const done = new Set((await DayClose.find({ _id: { $in: dates } }, '_id').lean()).map((x) => x._id));
  const days = [];
  for (const date of dates) {
    if (done.has(date)) continue;
    days.push(await closeDay(date, { now }));
  }
  return { start, days };
}

let running = false;
// Starts the end-of-day check: once now (catching up on anything missed while the server was
// off) and then every few minutes. Never runs two checks at once, never crashes the server.
function startDayCloseScheduler({ intervalMs = 15 * 60 * 1000 } = {}) {
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const result = await processPendingDays();
      const marked = (result.days || []).reduce((n, d) => n + d.voided, 0);
      if (marked > 0) console.log(`[day-close] marked ${marked} employee-day(s) absent for no daily report`);
    } catch (err) {
      console.error('[day-close] failed:', err.message);
    } finally {
      running = false;
    }
  };
  run();
  const handle = setInterval(run, intervalMs);
  if (handle.unref) handle.unref();
  return handle;
}

module.exports = { closeDay, processPendingDays, startDayCloseScheduler, resolveRuleStart };
