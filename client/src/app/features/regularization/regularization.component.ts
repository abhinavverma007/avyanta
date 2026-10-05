import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { AttendanceRegularizationService } from '../../core/services/attendance-regularization.service';
import { RegularizationRecord } from '../../core/models/attendance-regularization.model';
import { istDateString } from '../../shared/utils/ist-date';

// Matches the backend's IST-based "today" (server/src/utils/istDate.js) —
// a browser-local/UTC date sits a full calendar day behind IST for part of
// the night, which would otherwise wrongly allow/default a future-looking
// date near midnight.
function todayStr(): string {
  return istDateString();
}

const PAGE_SIZE = 3;

@Component({
  selector: 'app-regularization',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe],
  templateUrl: './regularization.component.html',
  styleUrl: './regularization.component.scss',
})
export class RegularizationComponent implements OnInit {
  requests = signal<RegularizationRecord[]>([]);
  loading = signal(true);

  page = signal(1);
  totalPages = signal(1);
  total = signal(0);

  date = signal(todayStr());
  checkIn = signal('09:30');
  checkOut = signal('18:00');
  reason = signal('');
  submitting = signal(false);
  error = signal('');
  success = signal('');

  readonly i18n = inject(I18nService);

  constructor(private regularizationService: AttendanceRegularizationService) {}

  ngOnInit(): void {
    this.loadHistory();
  }

  loadHistory(): void {
    this.loading.set(true);
    this.regularizationService.mine(this.page(), PAGE_SIZE).then(res => {
      this.requests.set(res.requests);
      this.total.set(res.total);
      this.totalPages.set(res.totalPages);
      this.loading.set(false);
    });
  }

  prevPage(): void {
    if (this.page() <= 1) return;
    this.page.update(p => p - 1);
    this.loadHistory();
  }

  nextPage(): void {
    if (this.page() >= this.totalPages()) return;
    this.page.update(p => p + 1);
    this.loadHistory();
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }

  async submitRequest(): Promise<void> {
    this.error.set('');
    this.success.set('');

    if (!this.date()) {
      this.error.set(this.i18n.t('regularization.errDate'));
      return;
    }
    if (!this.reason().trim()) {
      this.error.set(this.i18n.t('requests.errReason'));
      return;
    }
    if (this.checkOut() <= this.checkIn()) {
      this.error.set(this.i18n.t('regularization.errTime'));
      return;
    }

    this.submitting.set(true);
    try {
      await this.regularizationService.apply({
        date: this.date(),
        reason: this.reason(),
        requestedCheckIn: this.checkIn(),
        requestedCheckOut: this.checkOut(),
      });
      this.success.set(this.i18n.t('regularization.success'));
      this.reason.set('');
      this.page.set(1);
      this.loadHistory();
    } catch (err: any) {
      this.error.set(err?.error?.message ?? this.i18n.t('requests.errSubmit'));
    } finally {
      this.submitting.set(false);
    }
  }
}
