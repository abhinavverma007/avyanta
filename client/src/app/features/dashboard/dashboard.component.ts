import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AttendanceService } from '../../core/services/attendance.service';
import { LeaveService } from '../../core/services/leave.service';
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

  currentTime = signal(new Date());
  monthlyData = signal<MonthlyAttendance | null>(null);
  leaveSummary = signal<LeaveSummary | null>(null);
  private clockTimer?: number;

  showUnmarkConfirm = signal(false);
  unmarking = signal(false);

  // Mini calendar
  readonly today = new Date();
  readonly DAYS_OF_WEEK = ['dashboard.dowSun', 'dashboard.dowMon', 'dashboard.dowTue', 'dashboard.dowWed', 'dashboard.dowThu', 'dashboard.dowFri', 'dashboard.dowSat'];

  constructor(
    private auth: AuthService,
    private attendance: AttendanceService,
    private leaveService: LeaveService,
    readonly i18n: I18nService,
  ) {}

  ngOnInit(): void {
    this.attendance.getCurrentMonthAttendance().then(data => this.monthlyData.set(data));
    this.attendance.loadToday();
    this.leaveService.summary().then(summary => this.leaveSummary.set(summary));
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

  getCalendarCells(): Array<{ day: number | null; status: string }> {
    const data = this.monthlyData();
    if (!data) return [];

    const firstDay = new Date(data.year, data.month - 1, 1).getDay();
    const cells: Array<{ day: number | null; status: string }> = [];

    for (let i = 0; i < firstDay; i++) cells.push({ day: null, status: '' });

    for (const d of data.days) {
      const dayNum = parseInt(d.date.split('-')[2], 10);
      cells.push({ day: dayNum, status: d.status });
    }
    return cells;
  }

  getMonthLabel(): string {
    const data = this.monthlyData();
    if (!data) return '';
    return new Date(data.year, data.month - 1, 1)
      .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  isToday(dayNum: number | null): boolean {
    if (!dayNum) return false;
    return dayNum === this.today.getDate();
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
