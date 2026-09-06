import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_SCOPE } from '../tokens/api-scope';
import { AdminLeave, LeaveStatus } from '../models/leave.model';

// Not providedIn: 'root' — provided fresh per-route instead so it always
// re-reads the current session's API_SCOPE (see admin-employee.service.ts
// for the full explanation, and app.routes.ts for where it's provided).
@Injectable()
export class AdminLeaveService {
  private readonly scope = inject(API_SCOPE);
  private readonly base = `${environment.apiUrl}/${this.scope}/leaves`;

  constructor(private http: HttpClient) {}

  list(status?: LeaveStatus): Promise<AdminLeave[]> {
    const params: Record<string, string> = {};
    if (status) params['status'] = status;
    return firstValueFrom(
      this.http.get<{ leaves: AdminLeave[] }>(this.base, { params }),
    ).then(r => r.leaves);
  }

  approve(id: string, reviewNote?: string): Promise<AdminLeave> {
    return firstValueFrom(
      this.http.patch<{ leave: AdminLeave }>(`${this.base}/${id}/approve`, { reviewNote }),
    ).then(r => r.leave);
  }

  reject(id: string, reviewNote?: string): Promise<AdminLeave> {
    return firstValueFrom(
      this.http.patch<{ leave: AdminLeave }>(`${this.base}/${id}/reject`, { reviewNote }),
    ).then(r => r.leave);
  }
}
