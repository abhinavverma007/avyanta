import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApplyLeavePayload, LeaveRecord, LeaveSummary, PaginatedLeaves } from '../models/leave.model';

@Injectable({ providedIn: 'root' })
export class LeaveService {
  private readonly base = `${environment.apiUrl}/leave`;

  constructor(private http: HttpClient) {}

  summary(year?: number, month?: number): Promise<LeaveSummary> {
    const params: Record<string, string> = {};
    if (year) params['year'] = String(year);
    if (month) params['month'] = String(month);
    return firstValueFrom(this.http.get<LeaveSummary>(`${this.base}/summary`, { params }));
  }

  mine(page = 1, limit = 10): Promise<PaginatedLeaves> {
    return firstValueFrom(
      this.http.get<PaginatedLeaves>(`${this.base}/mine`, { params: { page, limit } }),
    );
  }

  apply(payload: ApplyLeavePayload): Promise<LeaveRecord[]> {
    return firstValueFrom(this.http.post<{ leaves: LeaveRecord[] }>(this.base, payload)).then(r => r.leaves);
  }
}
