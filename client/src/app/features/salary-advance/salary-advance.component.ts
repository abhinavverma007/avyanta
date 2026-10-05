import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { SalaryAdvanceService } from '../../core/services/salary-advance.service';
import { SalaryAdvanceRequest } from '../../core/models/salary-advance.model';

@Component({
  selector: 'app-salary-advance',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe],
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

  readonly i18n = inject(I18nService);

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
      this.error.set(this.i18n.t('requests.errAmount'));
      return;
    }
    if (!this.reason().trim()) {
      this.error.set(this.i18n.t('requests.errReason'));
      return;
    }

    this.submitting.set(true);
    try {
      await this.advanceService.apply({ amount: this.amount()!, reason: this.reason() });
      this.success.set(this.i18n.t('advance.success'));
      this.amount.set(null);
      this.reason.set('');
      this.load();
    } catch (err: any) {
      this.error.set(err?.error?.message ?? this.i18n.t('requests.errSubmit'));
    } finally {
      this.submitting.set(false);
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }
}
