import { ReviewedBy, ReviewOverride } from './reviewer.model';
export type ReimbursementCategory = 'petrol' | 'food' | 'travel' | 'other';
export type ReimbursementStatus = 'pending' | 'approved' | 'rejected';

export interface Reimbursement {
  id: string;
  category: ReimbursementCategory;
  amount: number;
  description: string;
  date: string; // YYYY-MM-DD
  status: ReimbursementStatus;
  reviewNote: string;
  reviewedAt?: string;
  reviewedBy?: ReviewedBy | null;
  override?: ReviewOverride | null;
  createdAt: string;
}

export interface AdminReimbursement extends Reimbursement {
  employee: {
    id: string;
    name: string;
    employeeId: string;
    department: string;
  } | null;
}

export interface CreateReimbursementPayload {
  category: ReimbursementCategory;
  amount: number;
  description?: string;
  date: string;
}

export interface SalaryRow {
  employeeId: string;
  name: string;
  employeeCode: string;
  department: string;
  upiId: string;
  year: number;
  month: number;
  baseSalary: number;
  calendarDaysInMonth: number;
  elapsedDays: number;
  presentDays: number;
  absentDays: number;
  pendingLeaveDays: number;
  paidLeavesPerMonth: number;
  leavesTaken: number;
  perDaySalary: number;
  deduction: number;
  earnedTillDate: number;
  reimbursementTotal: number;
  reimbursementCount: number;
  advanceDeduction: number;
  advanceCount: number;
  payable: number;
  // Carried over like an EMI when the owner paid a custom amount: what last month carried
  // INTO this one, and what this month's payments carried on to the next. Positive = still
  // owed to the employee, negative = paid ahead (to be recovered). Both 0 when nothing carried.
  carriedIn: number;
  carriedOut: number;
  paidAmount: number;
  balance: number;
  lastPaidAt?: string;
}

export interface SalarySummary {
  year: number;
  month: number;
  rows: SalaryRow[];
  totalBalance: number;
}

export interface PayoutRecord {
  id: string;
  amount: number;
  paidAt: string;
  note: string;
  carryForward: number; // what this payment carried to next month (0 for a normal payout)
}

export interface SalaryDetail extends SalaryRow {
  reimbursements: Array<{
    id: string;
    category: ReimbursementCategory;
    amount: number;
    description: string;
    date: string;
  }>;
  advances: Array<{
    id: string;
    amount: number;
    reason: string;
    requestedDate: string;
  }>;
  payouts: PayoutRecord[];
}
