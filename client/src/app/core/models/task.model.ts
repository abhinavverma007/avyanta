export interface Coworker {
  id: string;
  name: string;
  employeeId: string;
}

export type TaskRange = 'all' | 'past' | 'today' | 'upcoming';

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface SiteLocation {
  lat: number;
  lng: number;
}

export interface TaskNote {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface EmployeeTask {
  id: string;
  title: string;
  description: string;
  site: string;
  siteLocation: SiteLocation | null;
  date: string; // YYYY-MM-DD
  status: TaskStatus;
  completedAt: string | null;
  coworkers: Coworker[]; // everyone else assigned to the same task that day
  notes: TaskNote[]; // oldest first
}

export interface PaginatedTasks {
  range: TaskRange;
  date: string; // YYYY-MM-DD, "today" per the server
  tasks: EmployeeTask[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
