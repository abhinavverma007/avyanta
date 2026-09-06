import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SalaryAdvanceService } from '../../core/services/salary-advance.service';
import { SalaryAdvanceRequest } from '../../core/models/salary-advance.model';

@Component({
  selector: 'app-salary-advance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './salary-advance.component.html',
  styleUrl: './salary-advance.component.scss',
})
export class SalaryAdvanceComponent implements OnInit {
  requests = signal<SalaryAdvanceRequest[]>([]);
  loading = signal(true);

  amount = signal<number | null>(null);
  reason = signal('');
  submitting = signal(false);
  error = signal('');
  success = signal('');

  constructor(private advanceService: SalaryAdvanceService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.advanceService.mine().then(list => {
      this.requests.set(list);
      this.loading.set(false);
    });
  }

  onAmountInput(value: string): void {
    const digits = value.replace(/\D/g, '');
    this.amount.set(digits ? Number(digits) : null);
  }

  formatMoney(value: number | null): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '';
    return value.toLocaleString('en-IN');
  }

  async submitRequest(): Promise<void> {
    this.error.set('');
    this.success.set('');

    if (!this.amount() || this.amount()! <= 0) {
      this.error.set('Enter an amount greater than 0.');
      return;
    }
    if (!this.reason().trim()) {
      this.error.set('A reason is required.');
      return;
    }

    this.submitting.set(true);
    try {
      await this.advanceService.apply({ amount: this.amount()!, reason: this.reason() });
      this.success.set('Advance request submitted — awaiting superadmin approval. It\'ll be deducted from next month\'s salary once approved.');
      this.amount.set(null);
      this.reason.set('');
      this.load();
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Could not submit request. Please try again.');
    } finally {
      this.submitting.set(false);
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }
}
