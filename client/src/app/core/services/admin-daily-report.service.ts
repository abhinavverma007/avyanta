import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MissingReportEmployee, PaginatedReports } from '../models/daily-report.model';

// Read-only, and deliberately always /admin/daily-reports — reading the workers'
// daily reports has no /team scope equivalent, it is the owner's alone.
@Injectable({ providedIn: 'root' })
export class AdminDailyReportService {
  private readonly base = `${environment.apiUrl}/admin/daily-reports`;

  constructor(private http: HttpClient) {}

  list(params: { date: string; flagged?: boolean; page?: number }): Promise<PaginatedReports> {
    const query: Record<string, string> = { date: params.date };
    if (params.flagged) query['flagged'] = 'true';
    if (params.page) query['page'] = String(params.page);
    return firstValueFrom(this.http.get<PaginatedReports>(this.base, { params: query }));
  }

  // Employees who worked that day (have attendance) but haven't reported.
  missing(date: string): Promise<MissingReportEmployee[]> {
    return firstValueFrom(this.http.get<{ employees: MissingReportEmployee[] }>(`${this.base}/missing`, { params: { date } })).then(
      r => r.employees,
    );
  }
}
