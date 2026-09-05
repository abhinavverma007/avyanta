import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MonthlyAttendance, PunchResponse, TodayAttendance } from '../models/attendance.model';

function hhmmToDate(hhmm?: string): Date | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly base = `${environment.apiUrl}/attendance`;

  readonly punchState = signal<'in' | 'out'>('out');
  readonly lastPunchTime = signal<Date | null>(null);
  readonly firstPunchIn = signal<Date | null>(null);
  readonly lastPunchOut = signal<Date | null>(null);
  readonly workHours = signal<number | undefined>(undefined);
  readonly punching = signal(false);

  constructor(private http: HttpClient) {}

  async loadToday(): Promise<void> {
    const today = await firstValueFrom(this.http.get<TodayAttendance>(`${this.base}/today`));
    this.punchState.set(today.punchState);
    this.lastPunchTime.set(hhmmToDate(today.lastPunchAt));
    this.firstPunchIn.set(hhmmToDate(today.checkIn));
    this.lastPunchOut.set(hhmmToDate(today.checkOut));
    this.workHours.set(today.workHours);
  }

  async punch(): Promise<void> {
    this.punching.set(true);
    try {
      const res = await firstValueFrom(this.http.post<PunchResponse>(`${this.base}/punch`, {}));
      this.punchState.set(res.type);
      this.lastPunchTime.set(hhmmToDate(res.lastPunchAt));
      this.firstPunchIn.set(hhmmToDate(res.record.checkIn));
      this.lastPunchOut.set(hhmmToDate(res.record.checkOut));
      this.workHours.set(res.record.workHours);
    } finally {
      this.punching.set(false);
    }
  }

  // Wipes today's attendance entirely — back to the exact state as if no
  // punch had happened today. Server-side this is always scoped to today,
  // never a client-passed date.
  async unmarkToday(): Promise<void> {
    await firstValueFrom(this.http.delete<TodayAttendance>(`${this.base}/today`));
    this.punchState.set('out');
    this.lastPunchTime.set(null);
    this.firstPunchIn.set(null);
    this.lastPunchOut.set(null);
    this.workHours.set(undefined);
  }

  getMonthlyAttendance(year: number, month: number): Promise<MonthlyAttendance> {
    return firstValueFrom(
      this.http.get<MonthlyAttendance>(`${this.base}/monthly`, {
        params: { year, month },
      }),
    );
  }

  getCurrentMonthAttendance(): Promise<MonthlyAttendance> {
    const now = new Date();
    return this.getMonthlyAttendance(now.getFullYear(), now.getMonth() + 1);
  }
}
