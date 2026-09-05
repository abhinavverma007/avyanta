export interface Coworker {
  id: string;
  name: string;
  employeeId: string;
}

export type TaskRange = 'past' | 'today' | 'upcoming';

export interface EmployeeTask {
  id: string;
  title: string;
  description: string;
  site: string;
  date: string; // YYYY-MM-DD
  coworkers: Coworker[]; // everyone else assigned to the same task that day
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
