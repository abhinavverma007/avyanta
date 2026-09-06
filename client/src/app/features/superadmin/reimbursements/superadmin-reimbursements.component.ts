import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminReimbursementService } from '../../../core/services/admin-reimbursement.service';
import { AdminReimbursement, ReimbursementStatus } from '../../../core/models/reimbursement.model';
import { API_SCOPE } from '../../../core/tokens/api-scope';
import { AuthService } from '../../../core/services/auth.service';

type Tab = ReimbursementStatus | 'all';

@Component({
  selector: 'app-superadmin-reimbursements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './superadmin-reimbursements.component.html',
  styleUrl: './superadmin-reimbursements.component.scss',
})
export class SuperadminReimbursementsComponent implements OnInit {
  readonly tabs: Tab[] = ['all', 'pending', 'approved', 'rejected'];

  claims = signal<AdminReimbursement[]>([]);
  loading = signal(true);
  activeTab = signal<Tab>('pending');
  actingId = signal<string | null>(null);
  reviewNotes = signal<Record<string, string>>({});

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
    this.load();
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
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

  categoryLabel(category: string): string {
    const map: Record<string, string> = { petrol: 'Petrol', food: 'Food', travel: 'Travel', other: 'Other' };
    return map[category] ?? category;
  }
}
