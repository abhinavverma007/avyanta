import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { LeaveService } from '../../core/services/leave.service';
import { LeaveBalance, LeaveRequest } from '../../core/models/leave.model';

@Component({
  selector: 'app-leave',
  standalone: true,
  imports: [CommonModule, TitleCasePipe],
  templateUrl: './leave.component.html',
  styleUrl: './leave.component.scss',
})
export class LeaveComponent implements OnInit {
  balances = signal<LeaveBalance[]>([]);
  requests = signal<LeaveRequest[]>([]);
  activeFilter = signal<'all' | 'approved' | 'pending' | 'rejected'>('all');
  showApplyModal = signal(false);

  readonly leaveStats = { taken: 0, remaining: 1, total: 25 };

  constructor(private leaveService: LeaveService) {}

  ngOnInit(): void {
    this.balances.set(this.leaveService.getLeaveBalances());
    this.requests.set(this.leaveService.getLeaveRequests());
  }

  get filteredRequests(): LeaveRequest[] {
    const f = this.activeFilter();
    if (f === 'all') return this.requests();
    return this.requests().filter(r => r.status === f);
  }

  usedPercent(balance: LeaveBalance): number {
    return Math.round((balance.used / balance.total) * 100);
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      approved: 'badge-success',
      pending:  'badge-warning',
      rejected: 'badge-danger',
    };
    return map[status] ?? '';
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
