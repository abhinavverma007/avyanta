// Dictionaries are split per screen area so each stays small and reviewable.
// Keys are flat and dot-namespaced by area (e.g. "dashboard.title"); the
// `common.*` keys are shared. Every key in en/ must exist in hi/ — run
// scripts/check-i18n.mjs to verify.
import enCommon from './en/common.json';
import enDashboard from './en/dashboard.json';
import enAttendance from './en/attendance.json';
import enRequests from './en/requests.json';
import enTasks from './en/tasks.json';
import enSalary from './en/salary.json';
import enProfile from './en/profile.json';
import enSaEmployees from './en/sa-employees.json';
import enSaTasks from './en/sa-tasks.json';
import enSaApprovals from './en/sa-approvals.json';
import enSaSalary from './en/sa-salary.json';
import enSaRoles from './en/sa-roles.json';

import hiCommon from './hi/common.json';
import hiDashboard from './hi/dashboard.json';
import hiAttendance from './hi/attendance.json';
import hiRequests from './hi/requests.json';
import hiTasks from './hi/tasks.json';
import hiSalary from './hi/salary.json';
import hiProfile from './hi/profile.json';
import hiSaEmployees from './hi/sa-employees.json';
import hiSaTasks from './hi/sa-tasks.json';
import hiSaApprovals from './hi/sa-approvals.json';
import hiSaSalary from './hi/sa-salary.json';
import hiSaRoles from './hi/sa-roles.json';

export type Lang = 'en' | 'hi';
export type Dictionary = Record<string, string>;

export const TRANSLATIONS: Record<Lang, Dictionary> = {
  en: {
    ...enCommon, ...enDashboard, ...enAttendance, ...enRequests, ...enTasks, ...enSalary,
    ...enProfile, ...enSaEmployees, ...enSaTasks, ...enSaApprovals, ...enSaSalary, ...enSaRoles,
  },
  hi: {
    ...hiCommon, ...hiDashboard, ...hiAttendance, ...hiRequests, ...hiTasks, ...hiSalary,
    ...hiProfile, ...hiSaEmployees, ...hiSaTasks, ...hiSaApprovals, ...hiSaSalary, ...hiSaRoles,
  },
};
