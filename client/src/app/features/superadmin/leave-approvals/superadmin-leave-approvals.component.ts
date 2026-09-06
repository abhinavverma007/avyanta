import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminLeaveService } from '../../../core/services/admin-leave.service';
import { AdminLeave, LeaveStatus } from '../../../core/models/leave.model';
import { API_SCOPE } from '../../../core/tokens/api-scope';
import { AuthService } from '../../../core/services/auth.service';

type Tab = LeaveStatus | 'all';

@Component({
  selector: 'app-superadmin-leave-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './superadmin-leave-approvals.component.html',
  styleUrl: './superadmin-leave-approvals.component.scss',
})
export class SuperadminLeaveApprovalsComponent implements OnInit {
  readonly tabs: Tab[] = ['all', 'pending', 'approved', 'rejected'];

  leaves = signal<AdminLeave[]>([]);
  loading = signal(true);
  activeTab = signal<Tab>('pending');
  actingId = signal<string | null>(null);
  reviewNotes = signal<Record<string, string>>({});

  private readonly isAdminScope = inject(API_SCOPE) === 'admin';
  private readonly authService = inject(AuthService);

  constructor(private leaveService: AdminLeaveService) {}

  // A delegated Supervisor/Manager can't approve/reject their own leave
  // request — only the true owner can (enforced again server-side, see
  // reviewGuard.js — this is purely about not showing buttons that would
  // just 403 anyway).
  isOwnRequest(employeeId?: string): boolean {
    return !this.isAdminScope && !!employeeId && employeeId === this.authService.user()?.id;
  }

  ngOnInit(): void {
    this.load();
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const tab = this.activeTab();
    const status = tab === 'all' ? undefined : (tab as LeaveStatus);
    this.leaveService.list(status).then(list => {
      this.leaves.set(list);
      this.loading.set(false);
    });
  }

  noteFor(id: string): string {
    return this.reviewNotes()[id] ?? '';
  }

  setNote(id: string, value: string): void {
    this.reviewNotes.update(m => ({ ...m, [id]: value }));
  }

  async approve(leave: AdminLeave): Promise<void> {
    this.actingId.set(leave.id);
    try {
      await this.leaveService.approve(leave.id, this.noteFor(leave.id));
      this.load();
    } finally {
      this.actingId.set(null);
    }
  }

  async reject(leave: AdminLeave): Promise<void> {
    this.actingId.set(leave.id);
    try {
      await this.leaveService.reject(leave.id, this.noteFor(leave.id));
      this.load();
    } finally {
      this.actingId.set(null);
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }
}
