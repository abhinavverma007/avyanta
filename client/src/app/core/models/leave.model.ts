// No leave "types" — the superadmin sets a flat monthly quota per employee
// (Employee.paidLeavesPerMonth) and that's the only gate. Just dates + reason.
// Requests start 'pending' and only count as an actual leave day once the
// superadmin approves them.

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveSummary {
  year: number;
  month: number;
  quota: number;
  taken: number;
  remaining: number;
}

export interface LeaveRecord {
  id: string;
  date: string; // YYYY-MM-DD
  reason: string;
  status: LeaveStatus;
  reviewNote: string;
  reviewedAt?: string;
}

export interface AdminLeave extends LeaveRecord {
  employee: {
    id: string;
    name: string;
    employeeId: string;
    department: string;
  } | null;
}

export interface ApplyLeavePayload {
  dates: string[];
  reason: string;
}

export interface PaginatedLeaves {
  leaves: LeaveRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
