export type LeaveStatus = 'approved' | 'pending' | 'rejected';
export type LeaveType = 'casual' | 'sick' | 'paid' | 'comp_off' | 'maternity';

export interface LeaveRequest {
  id: string;
  type: LeaveType;
  typeName: string;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
  approvedBy?: string;
}

export interface LeaveBalance {
  type: LeaveType;
  typeName: string;
  used: number;
  total: number;
  remaining: number;
  color: string;
}
