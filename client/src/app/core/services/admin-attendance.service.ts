import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminMonthlyAttendance } from '../models/attendance.model';

@Injectable({ providedIn: 'root' })
export class AdminAttendanceService {
  private readonly base = `${environment.apiUrl}/admin/attendance`;

  constructor(private http: HttpClient) {}

  getMonthly(employeeId: string, year: number, month: number): Promise<AdminMonthlyAttendance> {
    return firstValueFrom(
      this.http.get<AdminMonthlyAttendance>(`${this.base}/${employeeId}/monthly`, {
        params: { year, month },
      }),
    );
  }
}
