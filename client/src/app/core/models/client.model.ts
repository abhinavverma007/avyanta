import { AdminTask, TaskStatus } from './admin-task.model';

// A client in the owner's client database, with the vendor it's served through
// (e.g. "Sharma Residence" via "Satya Solar").
export interface ClientRecord {
  id: string;
  name: string;
  vendorName: string;
  taskCount: number; // tasks assigned against this client
  lastServiced: string | null; // YYYY-MM-DD of the most recent task
  createdAt: string;
}

// What the Assign Task dropdown needs — no counts, readable by anyone who can assign tasks.
export interface ClientOption {
  id: string;
  name: string;
  vendorName: string;
}

export interface ClientPayload {
  name: string;
  vendorName: string;
}

// One client's servicing history: every task assigned against them (each task
// is one visit on one date), newest first, plus a summary of the whole history.
export interface ClientHistorySummary {
  totalTasks: number;
  daysServiced: number;
  completed: number;
  firstServiced: string | null;
  lastServiced: string | null;
}

export interface ClientHistory {
  client: { id: string; name: string; vendorName: string };
  summary: ClientHistorySummary;
  tasks: AdminTask[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ClientHistoryParams {
  status?: TaskStatus;
  from?: string;
  to?: string;
  page?: number;
}
