import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SalaryService } from '../../../core/services/salary.service';
import { AdminAuthService } from '../../../core/services/admin-auth.service';
import { AuthService } from '../../../core/services/auth.service';
import { SalaryDetail, SalaryRow } from '../../../core/models/reimbursement.model';

// Card view (mobile) only — the laptop table shows every matching row with
// no pagination, unchanged from before. Cards only show Name + Payable
// until tapped (see the template), so 10 fit per page without feeling
// cramped — higher than this app's usual page size of 3.
const CARD_PAGE_SIZE = 10;

// 'upi' — the owner tapped "Pay Now" and is confirming whether the UPI
// payment sheet actually went through. 'direct' — the owner tapped
// "Mark as Paid" straight away (paid by cash/bank transfer/no UPI ID on
// file) and is confirming that action instead. Both funnel into the same
// recordPayout call (see confirmMarkPaid) — this just decides which
// confirmation prompt is showing, so an accidental tap never silently
// records a payout with no "are you sure" step either way.
type PayConfirmMode = 'none' | 'upi' | 'direct';

@Component({
  selector: 'app-superadmin-salary',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TPipe],
  templateUrl: './superadmin-salary.component.html',
  styleUrl: './superadmin-salary.component.scss',
})
export class SuperadminSalaryComponent implements OnInit {
  readonly months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  readonly years: number[];

  // The name opens that employee's attendance history — but that page needs the Employees
  // permission, so a Salary-only Supervisor/Manager just sees the name as plain text.
  readonly canOpenAttendance =
    inject(AdminAuthService).isAuthenticated() || !!inject(AuthService).user()?.role?.permissions?.employees;

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

  // Set the moment either "Pay Now" or "Mark as Paid" is tapped, cleared
  // once the owner answers the resulting confirmation. Only one card can be
  // expanded at a time (see toggleDetail), so a single flag — not one keyed
  // by employeeId — is enough to track "is the currently-expanded row
  // mid-confirmation".
  payConfirmMode = signal<PayConfirmMode>('none');

  // "Pay a different amount": the owner types what to pay now; the difference from the
  // balance carries to next month. Kept separate from payConfirmMode on purpose so the
  // existing Pay Now / Mark as Paid flows are exactly as they were.
  customAmount = signal('');
  customMode = signal<PayConfirmMode>('none');

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

  constructor(private salaryService: SalaryService, readonly i18n: I18nService) {
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
    this.payConfirmMode.set('none');
    this.resetCustom();
    this.salaryService.summary(this.year(), this.month()).then(res => {
      this.rows.set(res.rows);
      this.search.set('');
      this.cardPage.set(1);
      this.loading.set(false);
    });
  }

  toggleDetail(row: SalaryRow): void {
    this.payConfirmMode.set('none');
    this.resetCustom();
    this.payoutError.set('');
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
      this.payoutError.set(err?.error?.message ?? this.i18n.t('saSalary.payoutFailed'));
    } finally {
      this.payingId.set(null);
    }
  }

  // "Pay Now" only opens the UPI app's payment sheet — there's no callback
  // telling this page whether the owner actually completed it there, so
  // without this, recording the payout was a second, easy-to-forget step
  // done from memory after switching apps and back. Chaining a "did it go
  // through?" prompt right onto the same tap closes that gap without
  // needing any payment-gateway integration.
  initiatePayment(): void {
    this.payoutError.set('');
    this.customMode.set('none');
    this.payConfirmMode.set('upi');
  }

  // "Mark as Paid" records a real payout with no undo — used for cash/bank
  // transfers, or whenever there's no UPI ID on file, so it's just as easy
  // to fat-finger as Pay Now and had no confirmation at all before this.
  // Same "are you sure" pattern as the UPI flow, just phrased for a payment
  // that already happened outside the app rather than one about to start.
  initiateDirectMarkPaid(): void {
    this.payoutError.set('');
    this.customMode.set('none');
    this.payConfirmMode.set('direct');
  }

  async confirmMarkPaid(row: SalaryRow): Promise<void> {
    await this.markAsPaid(row);
    if (!this.payoutError()) {
      this.payConfirmMode.set('none');
    }
  }

  cancelPayConfirm(): void {
    this.payConfirmMode.set('none');
    this.payoutError.set('');
  }

  // ── Pay a different amount (carries the difference to next month) ──────────

  abs(n: number): number {
    return Math.abs(n);
  }

  // "−₹3,000" / "₹3,000" — a plain `₹{{ n | number }}` would print a negative as "₹-3,000".
  signedMoney(n: number): string {
    return `${n < 0 ? '−' : ''}₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }

  private resetCustom(): void {
    this.customAmount.set('');
    this.customMode.set('none');
  }

  // Digits and one decimal point, at most two decimals — nothing else gets in.
  onCustomAmountInput(value: string): void {
    let cleaned = value.replace(/[^0-9.]/g, '');
    const firstDot = cleaned.indexOf('.');
    if (firstDot >= 0) cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '').slice(0, 2);
    this.customAmount.set(cleaned);
    this.customMode.set('none');
    this.payoutError.set('');
  }

  customAmountValue(): number | null {
    const t = this.customAmount().trim();
    if (t === '' || t === '.') return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  }

  // What typing this amount would do, against the current balance. null = nothing to show/do.
  customPreview(balance: number): { amount: number; carry: number; kind: 'same' | 'surplus' | 'over' | 'defer' | 'deferNegative' } | null {
    const amount = this.customAmountValue();
    if (amount === null) return null;
    const carry = Math.round((balance - amount) * 100) / 100;
    if (amount === 0 && carry === 0) return null;
    if (carry === 0) return { amount, carry, kind: 'same' };
    if (amount === 0) return { amount, carry, kind: carry > 0 ? 'defer' : 'deferNegative' };
    return { amount, carry, kind: carry > 0 ? 'surplus' : 'over' };
  }

  // "November 2026" — the month a custom payment's difference lands in.
  nextMonthLabel(row: SalaryRow): string {
    const name = this.months[row.month % 12];
    return `${name} ${row.month === 12 ? row.year + 1 : row.year}`;
  }

  // Same UPI request as Pay Now, but for the typed amount instead of the balance.
  customPayUrl(row: SalaryRow): string {
    const params = new URLSearchParams({
      pa: row.upiId,
      pn: row.name,
      am: (this.customAmountValue() ?? 0).toFixed(2),
      cu: 'INR',
      tn: `Salary ${this.months[row.month - 1]} ${row.year} - ${row.name}`,
    });
    return `upi://pay?${params.toString()}`;
  }

  startCustom(mode: PayConfirmMode): void {
    this.payoutError.set('');
    this.payConfirmMode.set('none');
    this.customMode.set(mode);
  }

  cancelCustom(): void {
    this.customMode.set('none');
    this.payoutError.set('');
  }

  async confirmCustom(row: SalaryRow): Promise<void> {
    const amount = this.customAmountValue();
    if (amount === null) return;
    this.payoutError.set('');
    this.payingId.set(row.employeeId);
    try {
      const updated = await this.salaryService.recordPayout(row.employeeId, row.year, row.month, amount, undefined, true);
      this.rows.update(list => list.map(r => (r.employeeId === row.employeeId ? { ...r, ...updated } : r)));
      if (this.expandedId() === row.employeeId) this.fetchDetail(row.employeeId);
      this.resetCustom();
    } catch (err: any) {
      this.payoutError.set(err?.error?.message ?? this.i18n.t('saSalary.payoutFailed'));
    } finally {
      this.payingId.set(null);
    }
  }
}
