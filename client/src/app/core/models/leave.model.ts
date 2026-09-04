// No leave "types" — the superadmin sets a flat monthly quota per employee
// (Employee.paidLeavesPerMonth) and that's the only gate. Just dates + reason.

export interface LeaveSummary {
  year: number;
  month: number;
  quota: number;
  taken: number;
  remaining: number;
}

export interface LeaveRecord {
  date: string; // YYYY-MM-DD
  reason: string;
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
