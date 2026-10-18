import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminClientService } from '../../../core/services/admin-client.service';
import { ClientHistory } from '../../../core/models/client.model';
import { TaskStatus } from '../../../core/models/admin-task.model';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';

// One client's servicing history — every visit (task) assigned against them over
// time, newest first, with a summary and optional status / date filters.
@Component({
  selector: 'app-superadmin-client-history',
  standalone: true,
  imports: [CommonModule, RouterLink, TPipe],
  templateUrl: './superadmin-client-history.component.html',
  styleUrl: './superadmin-client-history.component.scss',
})
export class SuperadminClientHistoryComponent implements OnInit {
  private readonly service = inject(AdminClientService);
  private readonly route = inject(ActivatedRoute);
  readonly i18n = inject(I18nService);

  private clientId = '';
  data = signal<ClientHistory | null>(null);
  loading = signal(true);
  error = signal('');

  status = signal<TaskStatus | ''>('');
  from = signal('');
  to = signal('');
  page = signal(1);

  readonly statusOptions: { value: TaskStatus | ''; label: string }[] = [
    { value: '', label: 'saClients.allStatuses' },
    { value: 'pending', label: 'saTaskForm.statusPending' },
    { value: 'in_progress', label: 'saTaskForm.statusInProgress' },
    { value: 'completed', label: 'saTaskForm.statusCompleted' },
  ];

  ngOnInit(): void {
    this.clientId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.service
      .history(this.clientId, {
        status: this.status() || undefined,
        from: this.from() || undefined,
        to: this.to() || undefined,
        page: this.page(),
      })
      .then(d => this.data.set(d))
      .catch(err => this.error.set(err?.status === 404 ? this.i18n.t('saClients.historyNotFound') : this.i18n.t('saClients.historyLoadError')))
      .finally(() => this.loading.set(false));
  }

  // Any filter change goes back to the first page.
  setStatus(v: string): void { this.status.set(v as TaskStatus | ''); this.page.set(1); this.load(); }
  setFrom(v: string): void { this.from.set(v); this.page.set(1); this.load(); }
  setTo(v: string): void { this.to.set(v); this.page.set(1); this.load(); }

  get hasFilters(): boolean {
    return !!(this.status() || this.from() || this.to());
  }

  clearFilters(): void {
    this.status.set('');
    this.from.set('');
    this.to.set('');
    this.page.set(1);
    this.load();
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  badgeClass(status: string): string {
    if (status === 'completed') return 'badge-success';
    if (status === 'in_progress') return 'badge-info';
    return 'badge-warning';
  }

  statusKey(status: string): string {
    return status === 'completed' ? 'saTaskForm.statusCompleted' : status === 'in_progress' ? 'saTaskForm.statusInProgress' : 'saTaskForm.statusPending';
  }
}
