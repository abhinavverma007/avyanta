import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LeaveService } from '../../core/services/leave.service';
import { LeaveRecord, LeaveSummary } from '../../core/models/leave.model';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
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
  imports: [CommonModule, FormsModule],
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
      this.error.set('Pick a valid date range.');
      return;
    }
    if (!this.reason().trim()) {
      this.error.set('A reason is required.');
      return;
    }

    this.submitting.set(true);
    try {
      await this.leaveService.apply({ dates, reason: this.reason() });
      this.success.set(`Leave request submitted for ${dates.length} day${dates.length === 1 ? '' : 's'} — awaiting superadmin approval.`);
      this.reason.set('');
      this.page.set(1);
      this.loadSummary();
      this.loadHistory();
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Could not apply leave. Please try again.');
    } finally {
      this.submitting.set(false);
    }
  }
}
