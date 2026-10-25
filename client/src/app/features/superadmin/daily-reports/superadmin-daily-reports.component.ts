import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AdminDailyReportService } from '../../../core/services/admin-daily-report.service';
import { DailyReport, MissingReportEmployee } from '../../../core/models/daily-report.model';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import { formatWorkDuration } from '../../../core/utils/format-duration';
import { istDateString } from '../../../shared/utils/ist-date';

// The end-of-day work reports workers submit after punching out — what the
// stand-up call used to be. Flagged reports (a problem or a safety incident)
// are listed first; below the list, who worked but hasn't reported yet.
@Component({
  selector: 'app-superadmin-daily-reports',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './superadmin-daily-reports.component.html',
  styleUrl: './superadmin-daily-reports.component.scss',
})
export class SuperadminDailyReportsComponent implements OnInit {
  private readonly service = inject(AdminDailyReportService);
  private readonly route = inject(ActivatedRoute);
  readonly i18n = inject(I18nService);
  readonly formatWorkDuration = formatWorkDuration;

  date = signal(istDateString());
  flaggedOnly = signal(false);
  reports = signal<DailyReport[]>([]);
  total = signal(0);
  flaggedCount = signal(0);
  missing = signal<MissingReportEmployee[]>([]);
  loading = signal(true);
  error = signal('');

  ngOnInit(): void {
    // Deep link from a "problem reported" notification: ?date=…&flagged=1
    const q = this.route.snapshot.queryParamMap;
    const date = q.get('date');
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) this.date.set(date);
    if (q.get('flagged')) this.flaggedOnly.set(true);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    Promise.all([
      this.service.list({ date: this.date(), flagged: this.flaggedOnly() }),
      this.service.missing(this.date()),
    ])
      .then(([list, missing]) => {
        this.reports.set(list.reports);
        this.total.set(list.total);
        this.flaggedCount.set(list.flaggedCount);
        this.missing.set(missing);
      })
      .catch(() => this.error.set(this.i18n.t('dailyReport.owner.loadError')))
      .finally(() => this.loading.set(false));
  }

  setDate(value: string): void {
    if (!value) return;
    this.date.set(value);
    this.load();
  }

  setFlaggedOnly(value: boolean): void {
    this.flaggedOnly.set(value);
    this.load();
  }

  shiftDay(delta: number): void {
    const [y, m, d] = this.date().split('-').map(Number);
    this.date.set(istDateString(new Date(Date.UTC(y, m - 1, d + delta))));
    this.load();
  }

  isToday(): boolean {
    return this.date() === istDateString();
  }

  // A finished day: anyone still without a report was marked absent by the end-of-day check.
  isPast(): boolean {
    return this.date() < istDateString();
  }

  realProblems(r: DailyReport): string[] {
    return r.problems.filter(p => p !== 'none');
  }
}
