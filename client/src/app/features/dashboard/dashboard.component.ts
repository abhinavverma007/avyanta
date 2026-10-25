import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AttendanceService } from '../../core/services/attendance.service';
import { LeaveService } from '../../core/services/leave.service';
import { DailyReportService } from '../../core/services/daily-report.service';
import { MonthlyAttendance } from '../../core/models/attendance.model';
import { LeaveSummary } from '../../core/models/leave.model';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { formatWorkDuration } from '../../core/utils/format-duration';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, TPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly user = computed(() => this.auth.user());
  readonly punchState = computed(() => this.attendance.punchState());
  readonly lastPunchTime = computed(() => this.attendance.lastPunchTime());
  readonly workHours = computed(() => this.attendance.workHours());
  readonly punching = computed(() => this.attendance.punching());
  readonly formatWorkDuration = formatWorkDuration;

  // Today's work report: 'pending' = worked but not written yet, 'submitted' = in (and
  // still editable until the day ends), 'none' = nothing to report (didn't punch in).
  reportState = signal<'none' | 'pending' | 'submitted'>('none');
  reportUpdatedAt = signal<string | null>(null);
  currentTime = signal(new Date());
  monthlyData = signal<MonthlyAttendance | null>(null);
  leaveSummary = signal<LeaveSummary | null>(null);
  private clockTimer?: number;

  showUnmarkConfirm = signal(false);
  unmarking = signal(false);

  constructor(
    private auth: AuthService,
    private attendance: AttendanceService,
    private leaveService: LeaveService,
    private reports: DailyReportService,
    private router: Router,
    readonly i18n: I18nService,
  ) {}

  ngOnInit(): void {
    this.attendance.getCurrentMonthAttendance().then(data => this.monthlyData.set(data));
    this.attendance.loadToday();
    this.leaveService.summary().then(summary => this.leaveSummary.set(summary));
    this.loadPendingReports();
    this.clockTimer = window.setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.clockTimer);
  }

  async punch(): Promise<void> {
    await this.attendance.punch();
    this.attendance.getCurrentMonthAttendance().then(data => this.monthlyData.set(data));
    // After punching out, land on the end-of-day work report — unless today's is
    // already in (a lunch-break punch-out shouldn't ask again). A report is never
    // required to punch in, and "do it later" on the form comes straight back here.
    if (this.punchState() === 'out') {
      try {
        const today = await this.reports.get('today');
        if (today.punchedIn && !today.report) await this.router.navigate(['/daily-report']);
      } catch {
        // The report is a convenience — never let it get in the way of punching.
      }
    }
  }

  private loadPendingReports(): void {
    this.reports
      .get('today')
      .then(r => {
        this.reportUpdatedAt.set(r.report?.updatedAt ?? null);
        this.reportState.set(r.report ? 'submitted' : r.punchedIn ? 'pending' : 'none');
      })
      .catch(() => this.reportState.set('none'));
  }

  async unmarkToday(): Promise<void> {
    this.unmarking.set(true);
    try {
      await this.attendance.unmarkToday();
      this.showUnmarkConfirm.set(false);
      this.attendance.getCurrentMonthAttendance().then(data => this.monthlyData.set(data));
    } finally {
      this.unmarking.set(false);
    }
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
  }

  greetUser(): string {
    const h = this.currentTime().getHours();
    if (h < 12) return this.i18n.t('dashboard.goodMorning');
    if (h < 17) return this.i18n.t('dashboard.goodAfternoon');
    return this.i18n.t('dashboard.goodEvening');
  }

  getFirstName(): string {
    return this.user()?.name?.split(' ')[0] ?? '';
  }
}
