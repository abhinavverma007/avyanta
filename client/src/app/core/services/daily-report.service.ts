import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DailyReport, ReportFormData, SubmitReportPayload } from '../models/daily-report.model';

// The signed-in employee's own end-of-day work report (the plain-employee
// side — the owner's reading side is AdminDailyReportService).
@Injectable({ providedIn: 'root' })
export class DailyReportService {
  private readonly base = `${environment.apiUrl}/daily-reports`;

  constructor(private http: HttpClient) {}

  // Dates (today / yesterday) the employee worked but hasn't reported on yet.
  pending(): Promise<string[]> {
    return firstValueFrom(this.http.get<{ dates: string[] }>(`${this.base}/pending`)).then(r => r.dates);
  }

  get(date: string): Promise<ReportFormData> {
    return firstValueFrom(this.http.get<ReportFormData>(`${this.base}/${date}`));
  }

  submit(date: string, payload: SubmitReportPayload): Promise<DailyReport> {
    return firstValueFrom(this.http.put<{ report: DailyReport }>(`${this.base}/${date}`, payload)).then(r => r.report);
  }
}
