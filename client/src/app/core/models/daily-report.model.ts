// The kinds of work and problems a worker can tap in the end-of-day report.
// These keys match the server (models/DailyReport.js); the wording shown to
// people lives in the translation files (dailyReport.work.* / dailyReport.problem.*).
export const WORK_TYPES = [
  'structure', 'panel_fitting', 'wiring', 'inverter', 'earthing', 'meter',
  'testing', 'survey', 'material_handling', 'maintenance', 'travel', 'other',
] as const;

export const PROBLEMS = [
  'material_shortage', 'tools_missing', 'weather', 'client_unavailable',
  'power_access', 'waiting_vendor', 'faulty_equipment',
] as const; // 'none' is its own exclusive choice in the form

export interface ReportJob {
  taskId: string;
  title: string;
  site: string;
}

export interface DailyReport {
  id: string;
  date: string;
  employee: { id: string; name: string; employeeId: string } | null;
  jobs: ReportJob[];
  workTypes: string[];
  problems: string[];
  problemNote: string;
  safetyIncident: boolean;
  safetyNote: string;
  messageToOwner: string;
  hoursWorked: number | null;
  punchedInAt: string | null;
  punchedOutAt: string | null;
  flagged: boolean;
  submittedAt: string;
  updatedAt: string;
}

export interface ReportFormData {
  date: string;
  isToday: boolean;
  punchedIn: boolean;
  tasks: { id: string; title: string; site: string; status: string }[];
  report: DailyReport | null;
}

export interface SubmitReportPayload {
  workTypes: string[];
  problems: string[];
  problemNote?: string;
  safetyIncident: boolean;
  safetyNote?: string;
  messageToOwner?: string;
}

export interface PaginatedReports {
  date: string;
  reports: DailyReport[];
  total: number;
  flaggedCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MissingReportEmployee {
  id: string;
  name: string;
  employeeId: string;
}
