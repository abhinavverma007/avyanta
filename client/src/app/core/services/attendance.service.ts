import { Injectable, signal } from '@angular/core';
import { AttendanceStatus, DayAttendance, MonthlyAttendance, PunchRecord } from '../models/attendance.model';

function buildMonthData(year: number, month: number): DayAttendance[] {
  const today = new Date();
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: DayAttendance[] = [];

  const statuses: AttendanceStatus[] = [
    'present','present','present','absent','present','present','leave',
    'present','present','present','absent','present','leave','present',
    'present','absent','present','present','present','absent','present',
    'leave','present','present','present','absent','present','present',
    'present','present','present',
  ];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dayOfWeek = date.getDay();
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isFuture = date > today;
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isFuture) {
      days.push({ date: dateStr, status: 'future' });
    } else if (isWeekend) {
      days.push({ date: dateStr, status: 'weekend' });
    } else {
      const status = statuses[(d - 1) % statuses.length];
      days.push({
        date: dateStr,
        status,
        checkIn:  status === 'present' ? `${8 + Math.floor(Math.random()*2)}:${Math.random()>0.5?'05':'30'}` : undefined,
        checkOut: status === 'present' ? `17:${Math.random()>0.5?'00':'30'}` : undefined,
        workHours: status === 'present' ? 8 + Math.random() * 2 : undefined,
      });
    }
  }
  return days;
}

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private today = new Date();

  readonly punchState = signal<'in' | 'out'>('out');
  readonly lastPunchTime = signal<Date | null>(null);
  readonly punchHistory = signal<PunchRecord[]>([]);

  getMonthlyAttendance(year: number, month: number): MonthlyAttendance {
    const days = buildMonthData(year, month);
    const workingDays = days.filter(d => d.status !== 'weekend' && d.status !== 'future');
    return {
      month, year, days,
      presentDays: workingDays.filter(d => d.status === 'present').length,
      absentDays:  workingDays.filter(d => d.status === 'absent').length,
      leaveDays:   workingDays.filter(d => d.status === 'leave').length,
      totalWorkingDays: workingDays.length,
    };
  }

  getCurrentMonthAttendance(): MonthlyAttendance {
    return this.getMonthlyAttendance(this.today.getFullYear(), this.today.getMonth() + 1);
  }

  punch(): void {
    const type: 'in' | 'out' = this.punchState() === 'out' ? 'in' : 'out';
    const now = new Date();
    this.punchState.set(type);
    this.lastPunchTime.set(now);
    this.punchHistory.update(h => [{ type, timestamp: now }, ...h]);
  }
}
