import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceRegularizationService } from '../../core/services/attendance-regularization.service';
import { RegularizationRecord } from '../../core/models/attendance-regularization.model';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

const PAGE_SIZE = 3;

@Component({
  selector: 'app-regularization',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
      this.error.set('A date is required.');
      return;
    }
    if (!this.reason().trim()) {
      this.error.set('A reason is required.');
      return;
    }
    if (this.checkOut() <= this.checkIn()) {
      this.error.set('Check-out must be after check-in.');
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
      this.success.set('Regularization request submitted — awaiting superadmin approval.');
      this.reason.set('');
      this.page.set(1);
      this.loadHistory();
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Could not submit request. Please try again.');
    } finally {
      this.submitting.set(false);
    }
  }
}
