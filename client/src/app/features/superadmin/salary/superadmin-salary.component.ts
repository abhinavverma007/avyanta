import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SalaryService } from '../../../core/services/salary.service';
import { SalaryDetail, SalaryRow } from '../../../core/models/reimbursement.model';

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
  totalPayable = signal(0);
  loading = signal(true);

  expandedId = signal<string | null>(null);
  detail = signal<SalaryDetail | null>(null);
  detailLoading = signal(false);

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

  load(): void {
    this.loading.set(true);
    this.expandedId.set(null);
    this.detail.set(null);
    this.salaryService.summary(this.year(), this.month()).then(res => {
      this.rows.set(res.rows);
      this.totalPayable.set(res.totalPayable);
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
