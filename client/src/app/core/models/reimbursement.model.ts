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
