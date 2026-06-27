import { Injectable } from '@angular/core';
import { LeaveBalance, LeaveRequest, LeaveStatus } from '../models/leave.model';

@Injectable({ providedIn: 'root' })
export class LeaveService {

  getLeaveBalances(): LeaveBalance[] {
    return [
      { type: 'casual',  typeName: 'Casual Leave',  used: 4,  total: 12, remaining: 8,  color: '#F7700A' },
      { type: 'sick',    typeName: 'Sick Leave',    used: 3,  total: 10, remaining: 7,  color: '#0F9D58' },
      { type: 'paid',    typeName: 'Paid Leave',    used: 5,  total: 15, remaining: 10, color: '#1B4FD8' },
      { type: 'comp_off',typeName: 'Comp Off',      used: 1,  total: 4,  remaining: 3,  color: '#8B5CF6' },
    ];
  }

  getLeaveRequests(): LeaveRequest[] {
    return [
      {
        id: 'lr001',
        type: 'casual',
        typeName: 'Casual Leave',
        fromDate: '2021-01-29',
        toDate: '2021-01-29',
        days: 1,
        reason: 'Personal work',
        status: 'approved',
        appliedOn: '2021-01-24',
        approvedBy: 'Manager Deepak Singh',
      },
      {
        id: 'lr002',
        type: 'sick',
        typeName: 'Sick Leave',
        fromDate: '2021-09-09',
        toDate: '2021-09-10',
        days: 2,
        reason: 'Fever and rest',
        status: 'approved',
        appliedOn: '2021-09-08',
        approvedBy: 'Manager Deepak Singh',
      },
      {
        id: 'lr003',
        type: 'paid',
        typeName: 'Paid Leave',
        fromDate: '2024-06-20',
        toDate: '2024-06-21',
        days: 2,
        reason: 'Family vacation',
        status: 'pending',
        appliedOn: '2024-06-15',
      },
      {
        id: 'lr004',
        type: 'casual',
        typeName: 'Casual Leave',
        fromDate: '2024-07-04',
        toDate: '2024-07-04',
        days: 1,
        reason: 'Personal errand',
        status: 'rejected',
        appliedOn: '2024-07-01',
        approvedBy: 'Manager Deepak Singh',
      },
    ];
  }

  getLeaveStats(): { taken: number; remaining: number; total: number } {
    return { taken: 0, remaining: 1, total: 25 };
  }
}
