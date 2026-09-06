import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_SCOPE } from '../tokens/api-scope';
import { AdminSalaryAdvance, AdvanceStatus } from '../models/salary-advance.model';

// Not providedIn: 'root' — provided fresh per-route instead so it always
// re-reads the current session's API_SCOPE (see admin-employee.service.ts
// for the full explanation, and app.routes.ts for where it's provided).
@Injectable()
export class AdminSalaryAdvanceService {
  private readonly scope = inject(API_SCOPE);
  private readonly base = `${environment.apiUrl}/${this.scope}/advances`;

  constructor(private http: HttpClient) {}

  list(status?: AdvanceStatus): Promise<AdminSalaryAdvance[]> {
    const params: Record<string, string> = {};
    if (status) params['status'] = status;
    return firstValueFrom(
      this.http.get<{ requests: AdminSalaryAdvance[] }>(this.base, { params }),
    ).then(r => r.requests);
  }

  approve(id: string, reviewNote?: string): Promise<AdminSalaryAdvance> {
    return firstValueFrom(
      this.http.patch<{ request: AdminSalaryAdvance }>(`${this.base}/${id}/approve`, { reviewNote }),
    ).then(r => r.request);
  }

  reject(id: string, reviewNote?: string): Promise<AdminSalaryAdvance> {
    return firstValueFrom(
      this.http.patch<{ request: AdminSalaryAdvance }>(`${this.base}/${id}/reject`, { reviewNote }),
    ).then(r => r.request);
  }
}
