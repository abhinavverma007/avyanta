import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AttendanceService } from '../../core/services/attendance.service';
import { LeaveService } from '../../core/services/leave.service';
import { MonthlyAttendance } from '../../core/models/attendance.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly user = computed(() => this.auth.user());
  readonly punchState = computed(() => this.attendance.punchState());
  readonly lastPunchTime = computed(() => this.attendance.lastPunchTime());

  currentTime = signal(new Date());
  monthlyData = signal<MonthlyAttendance | null>(null);
  private clockTimer?: number;
  leaveStats = { taken: 0, remaining: 1, total: 25 };

  // Mini calendar
  readonly today = new Date();
  readonly DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  constructor(
    private auth: AuthService,
    private attendance: AttendanceService,
    private leaveService: LeaveService,
  ) {
    this.leaveStats = this.leaveService.getLeaveStats();
  }

  ngOnInit(): void {
    this.monthlyData.set(this.attendance.getCurrentMonthAttendance());
    this.clockTimer = window.setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.clockTimer);
  }

  punch(): void {
    this.attendance.punch();
    this.monthlyData.set(this.attendance.getCurrentMonthAttendance());
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
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  getFirstName(): string {
    return this.user()?.name?.split(' ')[0] ?? '';
  }
}
