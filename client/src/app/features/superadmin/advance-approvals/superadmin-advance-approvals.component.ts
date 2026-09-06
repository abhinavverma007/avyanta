import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminSalaryAdvanceService } from '../../../core/services/admin-salary-advance.service';
import { AdminSalaryAdvance, AdvanceStatus } from '../../../core/models/salary-advance.model';

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

  requests = signal<AdminSalaryAdvance[]>([]);
  loading = signal(true);
  activeTab = signal<Tab>('pending');
  actingId = signal<string | null>(null);
  reviewNotes = signal<Record<string, string>>({});

  constructor(private advanceService: AdminSalaryAdvanceService) {}

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

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }
}
