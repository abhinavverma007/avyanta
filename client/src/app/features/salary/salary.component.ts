import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MySalaryService } from '../../core/services/my-salary.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { SalaryDetail } from '../../core/models/reimbursement.model';

@Component({
  selector: 'app-salary',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe],
  templateUrl: './salary.component.html',
  styleUrl: './salary.component.scss',
})
export class SalaryComponent implements OnInit {
  readonly months = [
    'salary.month.1', 'salary.month.2', 'salary.month.3', 'salary.month.4', 'salary.month.5', 'salary.month.6',
    'salary.month.7', 'salary.month.8', 'salary.month.9', 'salary.month.10', 'salary.month.11', 'salary.month.12',
  ];
  readonly years: number[];

  year = signal(new Date().getFullYear());
  month = signal(new Date().getMonth() + 1);
  detail = signal<SalaryDetail | null>(null);
  loading = signal(true);

  constructor(private salaryService: MySalaryService) {
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
    this.salaryService.detail(this.year(), this.month()).then(d => {
      this.detail.set(d);
      this.loading.set(false);
    });
  }
}
