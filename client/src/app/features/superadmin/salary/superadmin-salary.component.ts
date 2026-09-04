import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SalaryService } from '../../../core/services/salary.service';
import { SalaryDetail, SalaryRow } from '../../../core/models/reimbursement.model';

// Card view (mobile) only — the laptop table shows every matching row with
// no pagination, unchanged from before.
const CARD_PAGE_SIZE = 3;

@Component({
  selector: 'app-superadmin-salary',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  readonly filteredRows = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.rows();
    return this.rows().filter(r => r.name.toLowerCase().includes(q));
  });

  readonly filteredTotalPayable = computed(() =>
    Math.round(this.filteredRows().reduce((sum, r) => sum + r.payable, 0) * 100) / 100,
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
    this.detailLoading.set(true);
    this.salaryService.detail(row.employeeId, this.year(), this.month()).then(d => {
      this.detail.set(d);
      this.detailLoading.set(false);
    });
  }
}
