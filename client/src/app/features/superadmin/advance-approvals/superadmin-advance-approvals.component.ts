import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminSalaryAdvanceService } from '../../../core/services/admin-salary-advance.service';
import { AdminSalaryAdvance, AdvanceStatus } from '../../../core/models/salary-advance.model';
import { API_SCOPE } from '../../../core/tokens/api-scope';
import { AuthService } from '../../../core/services/auth.service';
import { ApprovalListController, SortOption } from '../../../shared/utils/approval-list-controller';

type Tab = AdvanceStatus | 'all';

@Component({
  selector: 'app-superadmin-advance-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './superadmin-advance-approvals.component.html',
  styleUrl: './superadmin-advance-approvals.component.scss',
})
export class SuperadminAdvanceApprovalsComponent implements OnInit {
  readonly tabs: Tab[] = ['all', 'pending', 'approved', 'rejected'];
  readonly sortOptions: SortOption[] = [
    { key: 'date', label: 'Date' },
    { key: 'amount', label: 'Amount' },
    { key: 'employee', label: 'Employee' },
  ];

  requests = signal<AdminSalaryAdvance[]>([]);
  loading = signal(true);
  activeTab = signal<Tab>('pending');
  actingId = signal<string | null>(null);
  reviewNotes = signal<Record<string, string>>({});

  bulkNote = signal('');
  bulkActing = signal(false);

  readonly list = new ApprovalListController<AdminSalaryAdvance>(
    this.requests,
    request => `${request.employee?.name ?? ''} ${request.employee?.employeeId ?? ''} ${request.employee?.department ?? ''} ${request.reason}`,
    (request, key) => {
      if (key === 'employee') return request.employee?.name ?? '';
      if (key === 'amount') return request.amount;
      return request.requestedDate;
    },
    'date',
  );

  // Count + amount total for the advance requests currently in view (post search, pre pagination).
  readonly viewCount = computed(() => this.list.filtered().length);
  readonly viewTotal = computed(() => this.list.filtered().reduce((sum, r) => sum + r.amount, 0));

  private readonly isAdminScope = inject(API_SCOPE) === 'admin';
  private readonly authService = inject(AuthService);

  constructor(private advanceService: AdminSalaryAdvanceService) {}

  // A delegated Supervisor/Manager can't approve/reject their own advance
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
    this.list.clearSelection();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const tab = this.activeTab();
    const status = tab === 'all' ? undefined : (tab as AdvanceStatus);
    this.advanceService.list(status).then(list => {
      this.requests.set(list);
      this.loading.set(false);
    });
  }

  noteFor(id: string): string {
    return this.reviewNotes()[id] ?? '';
  }

  setNote(id: string, value: string): void {
    this.reviewNotes.update(m => ({ ...m, [id]: value }));
  }

  async approve(request: AdminSalaryAdvance): Promise<void> {
    this.actingId.set(request.id);
    try {
      await this.advanceService.approve(request.id, this.noteFor(request.id));
      this.load();
    } finally {
      this.actingId.set(null);
    }
  }

  async reject(request: AdminSalaryAdvance): Promise<void> {
    this.actingId.set(request.id);
    try {
      await this.advanceService.reject(request.id, this.noteFor(request.id));
      this.load();
    } finally {
      this.actingId.set(null);
    }
  }

  async bulkApprove(): Promise<void> {
    await this.bulkReview('approved');
  }

  async bulkReject(): Promise<void> {
    await this.bulkReview('rejected');
  }

  private async bulkReview(status: 'approved' | 'rejected'): Promise<void> {
    const ids = [...this.list.selectedIds()];
    if (ids.length === 0) return;
    this.bulkActing.set(true);
    try {
      const note = this.bulkNote();
      await Promise.allSettled(
        ids.map(id => (status === 'approved' ? this.advanceService.approve(id, note) : this.advanceService.reject(id, note))),
      );
      this.bulkNote.set('');
      this.list.clearSelection();
      this.load();
    } finally {
      this.bulkActing.set(false);
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }
}
