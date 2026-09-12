import { Component, OnInit, Input, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminReimbursementService } from '../../../core/services/admin-reimbursement.service';
import { AdminReimbursement, ReimbursementStatus } from '../../../core/models/reimbursement.model';
import { API_SCOPE } from '../../../core/tokens/api-scope';
import { AuthService } from '../../../core/services/auth.service';
import { ApprovalListController, SortOption } from '../../../shared/utils/approval-list-controller';

type Tab = ReimbursementStatus | 'all';

@Component({
  selector: 'app-superadmin-reimbursements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './superadmin-reimbursements.component.html',
  styleUrl: './superadmin-reimbursements.component.scss',
})
export class SuperadminReimbursementsComponent implements OnInit {
  // Set by the Approvals shell when deep-linked from elsewhere — pre-fills
  // the search box with an employee's code so their claims are isolated
  // immediately.
  @Input() initialSearch = '';

  readonly tabs: Tab[] = ['all', 'pending', 'approved', 'rejected'];
  readonly sortOptions: SortOption[] = [
    { key: 'date', label: 'Date' },
    { key: 'amount', label: 'Amount' },
    { key: 'employee', label: 'Employee' },
  ];

  claims = signal<AdminReimbursement[]>([]);
  loading = signal(true);
  activeTab = signal<Tab>('pending');
  actingId = signal<string | null>(null);
  reviewNotes = signal<Record<string, string>>({});

  bulkNote = signal('');
  bulkActing = signal(false);

  readonly list = new ApprovalListController<AdminReimbursement>(
    this.claims,
    claim => `${claim.employee?.name ?? ''} ${claim.employee?.employeeId ?? ''} ${claim.employee?.department ?? ''} ${claim.category} ${claim.description}`,
    (claim, key) => {
      if (key === 'employee') return claim.employee?.name ?? '';
      if (key === 'amount') return claim.amount;
      return claim.date;
    },
    'date',
  );

  // Count + amount total for the claims currently in view (post search, pre pagination).
  readonly viewCount = computed(() => this.list.filtered().length);
  readonly viewTotal = computed(() => this.list.filtered().reduce((sum, c) => sum + c.amount, 0));

  private readonly isAdminScope = inject(API_SCOPE) === 'admin';
  private readonly authService = inject(AuthService);

  constructor(private reimbursementService: AdminReimbursementService) {}

  // A delegated Supervisor/Manager can't approve/reject their own claim —
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
    const status = tab === 'all' ? undefined : (tab as ReimbursementStatus);
    this.reimbursementService.list(status).then(list => {
      this.claims.set(list);
      this.loading.set(false);
    });
  }

  noteFor(id: string): string {
    return this.reviewNotes()[id] ?? '';
  }

  setNote(id: string, value: string): void {
    this.reviewNotes.update(m => ({ ...m, [id]: value }));
  }

  async approve(claim: AdminReimbursement): Promise<void> {
    this.actingId.set(claim.id);
    try {
      await this.reimbursementService.approve(claim.id, this.noteFor(claim.id));
      this.load();
    } finally {
      this.actingId.set(null);
    }
  }

  async reject(claim: AdminReimbursement): Promise<void> {
    this.actingId.set(claim.id);
    try {
      await this.reimbursementService.reject(claim.id, this.noteFor(claim.id));
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
          status === 'approved' ? this.reimbursementService.approve(id, note) : this.reimbursementService.reject(id, note),
        ),
      );
      this.bulkNote.set('');
      this.list.clearSelection();
      this.load();
    } finally {
      this.bulkActing.set(false);
    }
  }

  categoryLabel(category: string): string {
    const map: Record<string, string> = { petrol: 'Petrol', food: 'Food', travel: 'Travel', other: 'Other' };
    return map[category] ?? category;
  }
}
