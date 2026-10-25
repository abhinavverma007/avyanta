import { AdminTask, TaskStatus } from './admin-task.model';

// A client in the owner's client database, with the vendor it's served through
// (e.g. "Sharma Residence" via "Satya Solar").
export interface ClientRecord {
  id: string;
  clientCode: string; // CD-0001 — unique, assigned automatically, never changes
  name: string;
  vendorName: string;
  // Optional details — empty string when not given. Owner-only: the Assign Task dropdown
  // (ClientOption below) never carries them.
  mobileNumber: string;
  address: string;
  addressLocation: { lat: number; lng: number } | null; // the pin on the map for that address
  email: string;
  wifiEmail: string; // the login the client's Wi-Fi / monitoring configuration was set up with
  wifiPassword: string;
  taskCount: number; // tasks assigned against this client
  lastServiced: string | null; // YYYY-MM-DD of the most recent task
  createdAt: string;
}

// What the Assign Task dropdown needs — no counts, readable by anyone who can assign tasks.
// A client is identified there by code + vendor only ("CD-0001 — Satya Solar"); the name isn't sent.
export interface ClientOption {
  id: string;
  clientCode: string;
  vendorName: string;
}

export interface ClientPayload {
  name: string;
  vendorName: string;
  mobileNumber?: string;
  address?: string;
  addressLocation?: { lat: number; lng: number } | null; // null clears the pin
  email?: string;
  wifiEmail?: string;
  wifiPassword?: string;
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

// What a worker wrote in their end-of-day report about one visit.
export interface VisitReport {
  employeeName: string;
  workTypes: string[];
  problems: string[];
  problemNote: string;
  safetyIncident: boolean;
}

export interface ClientVisit extends AdminTask {
  reports: VisitReport[];
}

export interface ClientHistory {
  client: { id: string; clientCode: string; name: string; vendorName: string };
  summary: ClientHistorySummary;
  tasks: ClientVisit[];
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
