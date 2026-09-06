import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_SCOPE } from '../tokens/api-scope';
import { AdminRegularization, RegularizationStatus } from '../models/attendance-regularization.model';

// Not providedIn: 'root' — provided fresh per-route instead so it always
// re-reads the current session's API_SCOPE (see admin-employee.service.ts
// for the full explanation, and app.routes.ts for where it's provided).
@Injectable()
export class AdminAttendanceRegularizationService {
  private readonly scope = inject(API_SCOPE);
  private readonly base = `${environment.apiUrl}/${this.scope}/regularizations`;

  constructor(private http: HttpClient) {}

  list(status?: RegularizationStatus): Promise<AdminRegularization[]> {
    const params: Record<string, string> = {};
    if (status) params['status'] = status;
    return firstValueFrom(
      this.http.get<{ requests: AdminRegularization[] }>(this.base, { params }),
    ).then(r => r.requests);
  }

  approve(id: string, reviewNote?: string): Promise<AdminRegularization> {
    return firstValueFrom(
      this.http.patch<{ request: AdminRegularization }>(`${this.base}/${id}/approve`, { reviewNote }),
    ).then(r => r.request);
  }

  reject(id: string, reviewNote?: string): Promise<AdminRegularization> {
    return firstValueFrom(
      this.http.patch<{ request: AdminRegularization }>(`${this.base}/${id}/reject`, { reviewNote }),
    ).then(r => r.request);
  }
}
