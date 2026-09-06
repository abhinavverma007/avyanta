import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_SCOPE } from '../tokens/api-scope';
import { AdminMonthlyAttendance } from '../models/attendance.model';

// Not providedIn: 'root' — provided fresh per-route instead so it always
// re-reads the current session's API_SCOPE (see admin-employee.service.ts
// for the full explanation, and app.routes.ts for where it's provided).
@Injectable()
export class AdminAttendanceService {
  private readonly scope = inject(API_SCOPE);
  private readonly base = `${environment.apiUrl}/${this.scope}/attendance`;

  constructor(private http: HttpClient) {}

  getMonthly(employeeId: string, year: number, month: number): Promise<AdminMonthlyAttendance> {
    return firstValueFrom(
      this.http.get<AdminMonthlyAttendance>(`${this.base}/${employeeId}/monthly`, {
        params: { year, month },
      }),
    );
  }
}
