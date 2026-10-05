import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { LeaveService } from '../../core/services/leave.service';
import { LeaveRecord, LeaveSummary } from '../../core/models/leave.model';
import { istDateString } from '../../shared/utils/ist-date';

// Matches the backend's IST-based "today" (server/src/utils/istDate.js) —
// a browser-local/UTC date sits a full calendar day behind IST for part of
// the night, which would otherwise default this to yesterday.
function todayStr(): string {
  return istDateString();
}

function datesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const start = new Date(from);
  const end = new Date(to);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return dates;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

const PAGE_SIZE = 3;

@Component({
  selector: 'app-leave',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe],
  templateUrl: './leave.component.html',
  styleUrl: './leave.component.scss',
})
export class LeaveComponent implements OnInit {
  summary = signal<LeaveSummary | null>(null);
  leaves = signal<LeaveRecord[]>([]);
  loading = signal(true);

  page = signal(1);
  totalPages = signal(1);
  total = signal(0);

  fromDate = signal(todayStr());
  toDate = signal(todayStr());
  reason = signal('');
  submitting = signal(false);
  error = signal('');
  success = signal('');

  readonly selectedDates = computed(() => datesInRange(this.fromDate(), this.toDate()));

  readonly i18n = inject(I18nService);

  constructor(private leaveService: LeaveService) {}

  ngOnInit(): void {
    this.loadSummary();
    this.loadHistory();
  }

  loadSummary(): void {
    this.leaveService.summary().then(summary => this.summary.set(summary));
  }

  loadHistory(): void {
    this.loading.set(true);
    this.leaveService.mine(this.page(), PAGE_SIZE).then(res => {
      this.leaves.set(res.leaves);
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

  async submitLeave(): Promise<void> {
    this.error.set('');
    this.success.set('');

    const dates = this.selectedDates();
    if (dates.length === 0) {
      this.error.set(this.i18n.t('leave.errRange'));
      return;
    }
    if (!this.reason().trim()) {
      this.error.set(this.i18n.t('requests.errReason'));
      return;
    }

    this.submitting.set(true);
    try {
      await this.leaveService.apply({ dates, reason: this.reason() });
      this.success.set(this.i18n.t(dates.length === 1 ? 'leave.successOne' : 'leave.successMany', { n: dates.length }));
      this.reason.set('');
      this.page.set(1);
      this.loadSummary();
      this.loadHistory();
    } catch (err: any) {
      this.error.set(err?.error?.message ?? this.i18n.t('leave.errApply'));
    } finally {
      this.submitting.set(false);
    }
  }
}
