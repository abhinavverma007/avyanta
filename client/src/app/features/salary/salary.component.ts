import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MySalaryService } from '../../core/services/my-salary.service';
import { SalaryDetail } from '../../core/models/reimbursement.model';

@Component({
  selector: 'app-salary',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './salary.component.html',
  styleUrl: './salary.component.scss',
})
export class SalaryComponent implements OnInit {
  readonly months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
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
