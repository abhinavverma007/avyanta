export interface AdminTaskEmployee {
  id: string;
  name: string;
  employeeId: string;
}

export interface SiteLocation {
  lat: number;
  lng: number;
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface TaskNote {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface AdminTask {
  id: string;
  title: string;
  description: string;
  site: string;
  siteLocation: SiteLocation | null;
  date: string; // YYYY-MM-DD
  status: TaskStatus;
  completedAt: string | null;
  completedBy: { id: string; name: string } | null;
  employees: AdminTaskEmployee[];
  notes: TaskNote[]; // oldest first
  createdAt: string;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  site?: string;
  siteLocation?: SiteLocation;
  dates: string[];
  employeeIds: string[];
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  site?: string;
  siteLocation?: SiteLocation | null;
  date?: string;
  employeeIds?: string[];
  status?: TaskStatus;
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
  status?: TaskStatus;
  search?: string;
  page?: number;
  limit?: number;
}
