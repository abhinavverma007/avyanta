import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, SlicePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminAttendanceService } from '../../../core/services/admin-attendance.service';
import { AdminMonthlyAttendance, DayAttendance } from '../../../core/models/attendance.model';
import { TPipe } from '../../../core/i18n/t.pipe';
import { I18nService } from '../../../core/i18n/i18n.service';
import { formatWorkDuration } from '../../../core/utils/format-duration';

@Component({
  selector: 'app-superadmin-employee-attendance',
  standalone: true,
  imports: [CommonModule, SlicePipe, RouterLink, TPipe],
  templateUrl: './superadmin-employee-attendance.component.html',
  styleUrl: './superadmin-employee-attendance.component.scss',
})
export class SuperadminEmployeeAttendanceComponent implements OnInit {
  readonly DOW = ['saEmpAtt.dow.sun', 'saEmpAtt.dow.mon', 'saEmpAtt.dow.tue', 'saEmpAtt.dow.wed', 'saEmpAtt.dow.thu', 'saEmpAtt.dow.fri', 'saEmpAtt.dow.sat'];
  readonly i18n = inject(I18nService);
  readonly today = new Date();
  readonly formatWorkDuration = formatWorkDuration;

  employeeId = '';
  viewYear = signal(new Date().getFullYear());
  viewMonth = signal(new Date().getMonth() + 1);
  selectedDay = signal<DayAttendance | null>(null);

  monthlyData = signal<AdminMonthlyAttendance | null>(null);
  loading = signal(true);

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

  constructor(private route: ActivatedRoute, private attendanceService: AdminAttendanceService) {}

  ngOnInit(): void {
    this.employeeId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadMonth();
  }

  loadMonth(): void {
    this.loading.set(true);
    this.attendanceService
      .getMonthly(this.employeeId, this.viewYear(), this.viewMonth())
      .then(data => {
        this.monthlyData.set(data);
        this.loading.set(false);
      });
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
      present: 'saEmpAtt.present', absent: 'saEmpAtt.absent', leave: 'saEmpAtt.leave', pending: 'saEmpAtt.pending',
    };
    return map[status] ? this.i18n.t(map[status]) : (status === 'future' ? '—' : status);
  }
}
