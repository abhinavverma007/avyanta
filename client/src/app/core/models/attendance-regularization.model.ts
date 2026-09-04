// A request to correct a day with no valid attendance (forgot to punch).
// Only makes sense for a day the employee didn't already complete a punch
// cycle on, and that isn't an approved leave day.

export type RegularizationStatus = 'pending' | 'approved' | 'rejected';

export interface RegularizationRecord {
  id: string;
  date: string; // YYYY-MM-DD
  reason: string;
  requestedCheckIn: string; // HH:MM
  requestedCheckOut: string; // HH:MM
  status: RegularizationStatus;
  reviewNote: string;
  reviewedAt?: string;
}

export interface AdminRegularization extends RegularizationRecord {
  employee: {
    id: string;
    name: string;
    employeeId: string;
    department: string;
  } | null;
}

export interface ApplyRegularizationPayload {
  date: string;
  reason: string;
  requestedCheckIn: string;
  requestedCheckOut: string;
}

export interface PaginatedRegularizations {
  requests: RegularizationRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
