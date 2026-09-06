import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceService } from '../../core/services/attendance.service';
import { AttendanceRegularizationService } from '../../core/services/attendance-regularization.service';
import { MonthlyAttendance, DayAttendance } from '../../core/models/attendance.model';
import { RegularizationRecord } from '../../core/models/attendance-regularization.model';
import { formatWorkDuration } from '../../core/utils/format-duration';

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, SlicePipe, FormsModule],
  templateUrl: './attendance.component.html',
  styleUrl: './attendance.component.scss',
})
export class AttendanceComponent implements OnInit {
  readonly DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  readonly today = new Date();
  readonly formatWorkDuration = formatWorkDuration;

  viewYear = signal(new Date().getFullYear());
  viewMonth = signal(new Date().getMonth() + 1);
  selectedDay = signal<DayAttendance | null>(null);
  filterStatus = signal<string>('all');

  monthlyData = signal<MonthlyAttendance | null>(null);

  regularizations = signal<RegularizationRecord[]>([]);
  readonly regularizationByDate = computed(() => new Map(this.regularizations().map(r => [r.date, r])));

  regReason = signal('');
  regCheckIn = signal('09:30');
  regCheckOut = signal('18:00');
  regSubmitting = signal(false);
  regError = signal('');
  regSuccess = signal('');

  readonly calendarCells = computed(() => {
    const data = this.monthlyData();
    if (!data) return [];
    const firstDay = new Date(data.year, data.month - 1, 1).getDay();
    const cells: Array<DayAttendance | null> = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    cells.push(...data.days);
    return cells;
  });

  readonly monthLabel = computed(() => {
    const y = this.viewYear();
    const m = this.viewMonth();
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  });

  constructor(private attendance: AttendanceService, private regularizationService: AttendanceRegularizationService) {}

  ngOnInit(): void {
    this.loadMonth();
    this.loadRegularizations();
  }

  loadMonth(): void {
    this.attendance
      .getMonthlyAttendance(this.viewYear(), this.viewMonth())
      .then(data => this.monthlyData.set(data));
  }

  loadRegularizations(): void {
    this.regularizationService.mine(1, 100).then(res => this.regularizations.set(res.requests));
  }

  prevMonth(): void {
    let m = this.viewMonth() - 1;
    let y = this.viewYear();
    if (m < 1) { m = 12; y--; }
    this.viewMonth.set(m);
    this.viewYear.set(y);
    this.selectedDay.set(null);
    this.loadMonth();
  }

  nextMonth(): void {
    const now = new Date();
    if (this.viewYear() >= now.getFullYear() && this.viewMonth() >= now.getMonth() + 1) return;
    let m = this.viewMonth() + 1;
    let y = this.viewYear();
    if (m > 12) { m = 1; y++; }
    this.viewMonth.set(m);
    this.viewYear.set(y);
    this.selectedDay.set(null);
    this.loadMonth();
  }

  canGoNext(): boolean {
    const now = new Date();
    return !(this.viewYear() >= now.getFullYear() && this.viewMonth() >= now.getMonth() + 1);
  }

  selectDay(day: DayAttendance | null): void {
    if (!day || day.status === 'future') return;
    this.selectedDay.set(day);
    this.regReason.set('');
    this.regError.set('');
    this.regSuccess.set('');
  }

  async submitRegularization(): Promise<void> {
    const day = this.selectedDay();
    if (!day) return;

    this.regError.set('');
    this.regSuccess.set('');
    if (!this.regReason().trim()) {
      this.regError.set('A reason is required.');
      return;
    }
    if (this.regCheckOut() <= this.regCheckIn()) {
      this.regError.set('Check-out must be after check-in.');
      return;
    }

    this.regSubmitting.set(true);
    try {
      await this.regularizationService.apply({
        date: day.date,
        reason: this.regReason(),
        requestedCheckIn: this.regCheckIn(),
        requestedCheckOut: this.regCheckOut(),
      });
      this.regSuccess.set('Regularization request submitted — awaiting superadmin approval.');
      this.regReason.set('');
      this.loadRegularizations();
    } catch (err: any) {
      this.regError.set(err?.error?.message ?? 'Could not submit request. Please try again.');
    } finally {
      this.regSubmitting.set(false);
    }
  }

  isToday(day: DayAttendance | null): boolean {
    if (!day) return false;
    const d = parseInt(day.date.split('-')[2], 10);
    return d === this.today.getDate()
      && this.viewMonth() === this.today.getMonth() + 1
      && this.viewYear() === this.today.getFullYear();
  }

  formatDayDisplay(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      present: 'Present', absent: 'Absent', leave: 'Leave', pending: 'Pending Approval', future: '—',
    };
    return map[status] ?? status;
  }
}
