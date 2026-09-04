import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminAttendanceRegularizationService } from '../../../core/services/admin-attendance-regularization.service';
import { AdminRegularization, RegularizationStatus } from '../../../core/models/attendance-regularization.model';

type Tab = RegularizationStatus | 'all';

@Component({
  selector: 'app-superadmin-regularization-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './superadmin-regularization-approvals.component.html',
  styleUrl: './superadmin-regularization-approvals.component.scss',
})
export class SuperadminRegularizationApprovalsComponent implements OnInit {
  readonly tabs: Tab[] = ['pending', 'approved', 'rejected', 'all'];

  requests = signal<AdminRegularization[]>([]);
  loading = signal(true);
  activeTab = signal<Tab>('pending');
  actingId = signal<string | null>(null);
  reviewNotes = signal<Record<string, string>>({});

  constructor(private regularizationService: AdminAttendanceRegularizationService) {}

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

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }
}
