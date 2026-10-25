import { ReviewedBy, ReviewOverride } from './reviewer.model';
// A cash advance an employee asks for mid-month, recovered from their salary once
// approved (see salary.controller.js) — from the month it's requested in.

export type AdvanceStatus = 'pending' | 'approved' | 'rejected';

export interface SalaryAdvanceRequest {
  id: string;
  amount: number;
  reason: string;
  requestedDate: string; // YYYY-MM-DD
  // YYYY-MM — the salary month it comes out of. New advances: the month requested in. Older
  // ones: the month after requestedDate (the server resolves it, so this is always set).
  deductMonth: string;
  status: AdvanceStatus;
  reviewNote: string;
  reviewedAt?: string;
  reviewedBy?: ReviewedBy | null;
  override?: ReviewOverride | null;
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
