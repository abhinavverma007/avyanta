import { Component, OnInit, Input, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminAttendanceRegularizationService } from '../../../core/services/admin-attendance-regularization.service';
import { AdminRegularization, RegularizationStatus } from '../../../core/models/attendance-regularization.model';
import { API_SCOPE } from '../../../core/tokens/api-scope';
import { AuthService } from '../../../core/services/auth.service';
import { ApprovalListController, SortOption } from '../../../shared/utils/approval-list-controller';

type Tab = RegularizationStatus | 'all';

@Component({
  selector: 'app-superadmin-regularization-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './superadmin-regularization-approvals.component.html',
  styleUrl: './superadmin-regularization-approvals.component.scss',
})
export class SuperadminRegularizationApprovalsComponent implements OnInit {
  // Set by the Approvals shell when deep-linked from elsewhere — pre-fills
  // the search box with an employee's code so their requests are isolated
  // immediately.
  @Input() initialSearch = '';

  readonly tabs: Tab[] = ['all', 'pending', 'approved', 'rejected'];
  readonly sortOptions: SortOption[] = [
    { key: 'date', label: 'Date' },
    { key: 'employee', label: 'Employee' },
  ];

  requests = signal<AdminRegularization[]>([]);
  loading = signal(true);
  activeTab = signal<Tab>('pending');
  actingId = signal<string | null>(null);
  reviewNotes = signal<Record<string, string>>({});

  bulkNote = signal('');
  bulkActing = signal(false);

  readonly list = new ApprovalListController<AdminRegularization>(
    this.requests,
    request =>
      `${request.employee?.name ?? ''} ${request.employee?.employeeId ?? ''} ${request.employee?.department ?? ''} ${request.reason}`,
    (request, key) => (key === 'employee' ? request.employee?.name ?? '' : request.date),
    'date',
  );

  // Count of attendance fix requests currently in view (post search, pre pagination).
  readonly viewCount = computed(() => this.list.filtered().length);

  private readonly isAdminScope = inject(API_SCOPE) === 'admin';
  private readonly authService = inject(AuthService);

  constructor(private regularizationService: AdminAttendanceRegularizationService) {}

  // A delegated Supervisor/Manager can't approve/reject their own request —
  // only the true owner can (enforced again server-side, see
  // reviewGuard.js — this is purely about not showing buttons that would
  // just 403 anyway).
  isOwnRequest(employeeId?: string): boolean {
    return !this.isAdminScope && !!employeeId && employeeId === this.authService.user()?.id;
  }

  ngOnInit(): void {
    if (this.initialSearch) {
      this.list.setSearch(this.initialSearch);
    }
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
    const status = tab === 'all' ? undefined : (tab as RegularizationStatus);
    this.regularizationService.list(status).then(list => {
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

  async approve(request: AdminRegularization): Promise<void> {
    this.actingId.set(request.id);
    try {
      await this.regularizationService.approve(request.id, this.noteFor(request.id));
      this.load();
    } finally {
      this.actingId.set(null);
    }
  }

  async reject(request: AdminRegularization): Promise<void> {
    this.actingId.set(request.id);
    try {
      await this.regularizationService.reject(request.id, this.noteFor(request.id));
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
        ids.map(id =>
          status === 'approved' ? this.regularizationService.approve(id, note) : this.regularizationService.reject(id, note),
        ),
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
