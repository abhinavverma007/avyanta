// A cash advance an employee asks for mid-month, recovered from *next*
// month's payable salary once approved (see salary.controller.js).

export type AdvanceStatus = 'pending' | 'approved' | 'rejected';

export interface SalaryAdvanceRequest {
  id: string;
  amount: number;
  reason: string;
  requestedDate: string; // YYYY-MM-DD — the advance is deducted from the month right after this one
  status: AdvanceStatus;
  reviewNote: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface AdminSalaryAdvance extends SalaryAdvanceRequest {
  employee: {
    id: string;
    name: string;
    employeeId: string;
    department: string;
  } | null;
}

export interface ApplyAdvancePayload {
  amount: number;
  reason: string;
}
