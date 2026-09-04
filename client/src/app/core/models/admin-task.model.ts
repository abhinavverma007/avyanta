export interface AdminTaskEmployee {
  id: string;
  name: string;
  employeeId: string;
}

export interface AdminTask {
  id: string;
  title: string;
  description: string;
  site: string;
  date: string; // YYYY-MM-DD
  employees: AdminTaskEmployee[];
  createdAt: string;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  site?: string;
  dates: string[];
  employeeIds: string[];
}

export interface PaginatedTasks {
  tasks: AdminTask[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListTasksParams {
  date?: string;
  employeeId?: string;
  page?: number;
  limit?: number;
}
