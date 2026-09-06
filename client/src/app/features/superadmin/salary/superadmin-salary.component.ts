import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SalaryService } from '../../../core/services/salary.service';
import { SalaryDetail, SalaryRow } from '../../../core/models/reimbursement.model';

// Card view (mobile) only — the laptop table shows every matching row with
// no pagination, unchanged from before. Cards only show Name + Payable
// until tapped (see the template), so 10 fit per page without feeling
// cramped — higher than this app's usual page size of 3.
const CARD_PAGE_SIZE = 10;

@Component({
  selector: 'app-superadmin-salary',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './superadmin-salary.component.html',
  styleUrl: './superadmin-salary.component.scss',
})
export class SuperadminSalaryComponent implements OnInit {
  readonly months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  readonly years: number[];

  year = signal(new Date().getFullYear());
  month = signal(new Date().getMonth() + 1);
  rows = signal<SalaryRow[]>([]);
  loading = signal(true);

  search = signal('');
  cardPage = signal(1);

  expandedId = signal<string | null>(null);
  detail = signal<SalaryDetail | null>(null);
  detailLoading = signal(false);

  payingId = signal<string | null>(null);
  payoutError = signal('');

  readonly filteredRows = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.rows();
    return this.rows().filter(r => r.name.toLowerCase().includes(q));
  });

  readonly filteredTotalBalance = computed(() =>
    Math.round(this.filteredRows().reduce((sum, r) => sum + r.balance, 0) * 100) / 100,
  );

  readonly cardTotalPages = computed(() => Math.max(1, Math.ceil(this.filteredRows().length / CARD_PAGE_SIZE)));

  readonly cardRows = computed(() => {
    const start = (this.cardPage() - 1) * CARD_PAGE_SIZE;
    return this.filteredRows().slice(start, start + CARD_PAGE_SIZE);
  });

  constructor(private salaryService: SalaryService) {
    const currentYear = new Date().getFullYear();
    this.years = [currentYear - 1, currentYear, currentYear + 1];
  }

  ngOnInit(): void {
    this.load();
  }

  setYear(year: number): void {
    this.year.set(year);
    this.load();
  }

  setMonth(month: number): void {
    this.month.set(month);
    this.load();
  }

  onSearchInput(value: string): void {
    this.search.set(value);
    this.cardPage.set(1);
  }

  prevCardPage(): void {
    if (this.cardPage() <= 1) return;
    this.cardPage.update(p => p - 1);
  }

  nextCardPage(): void {
    if (this.cardPage() >= this.cardTotalPages()) return;
    this.cardPage.update(p => p + 1);
  }

  load(): void {
    this.loading.set(true);
    this.expandedId.set(null);
    this.detail.set(null);
    this.salaryService.summary(this.year(), this.month()).then(res => {
      this.rows.set(res.rows);
      this.search.set('');
      this.cardPage.set(1);
      this.loading.set(false);
    });
  }

  toggleDetail(row: SalaryRow): void {
    if (this.expandedId() === row.employeeId) {
      this.expandedId.set(null);
      this.detail.set(null);
      return;
    }
    this.expandedId.set(row.employeeId);
    this.fetchDetail(row.employeeId);
  }

  private fetchDetail(employeeId: string): void {
    this.detailLoading.set(true);
    this.salaryService.detail(employeeId, this.year(), this.month()).then(d => {
      this.detail.set(d);
      this.detailLoading.set(false);
    });
  }

  // upi://pay deep link — opens the phone's "pay with" chooser (GPay, PhonePe,
  // etc.) with the employee's UPI ID and the *remaining balance* prefilled
  // (not the full payable — if something's already been recorded as paid,
  // only the difference should be requested). This is just a request; there's
  // no callback confirming the owner actually completed it in their app.
  payUrl(row: SalaryRow): string {
    const params = new URLSearchParams({
      pa: row.upiId,
      pn: row.name,
      am: row.balance.toFixed(2),
      cu: 'INR',
      tn: `Salary ${this.months[row.month - 1]} ${row.year} - ${row.name}`,
    });
    return `upi://pay?${params.toString()}`;
  }

  // Records that the owner has paid the current balance — a fact, separate
  // from the live-recomputed `payable`. Doesn't reset anything; a later
  // correction to attendance/leave just changes the balance going forward
  // (see salary.controller.js), it never re-demands what's already settled.
  async markAsPaid(row: SalaryRow): Promise<void> {
    this.payoutError.set('');
    this.payingId.set(row.employeeId);
    try {
      const updated = await this.salaryService.recordPayout(row.employeeId, row.year, row.month, row.balance);
      this.rows.update(list => list.map(r => (r.employeeId === row.employeeId ? { ...r, ...updated } : r)));
      if (this.expandedId() === row.employeeId) {
        this.fetchDetail(row.employeeId);
      }
    } catch (err: any) {
      this.payoutError.set(err?.error?.message ?? 'Could not record payment. Please try again.');
    } finally {
      this.payingId.set(null);
    }
  }
}
