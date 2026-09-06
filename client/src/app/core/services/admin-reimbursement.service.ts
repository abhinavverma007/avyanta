import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_SCOPE } from '../tokens/api-scope';
import { AdminReimbursement, ReimbursementStatus } from '../models/reimbursement.model';

// Not providedIn: 'root' — provided fresh per-route instead so it always
// re-reads the current session's API_SCOPE (see admin-employee.service.ts
// for the full explanation, and app.routes.ts for where it's provided).
@Injectable()
export class AdminReimbursementService {
  private readonly scope = inject(API_SCOPE);
  private readonly base = `${environment.apiUrl}/${this.scope}/reimbursements`;

  constructor(private http: HttpClient) {}

  list(status?: ReimbursementStatus): Promise<AdminReimbursement[]> {
    const params: Record<string, string> = {};
    if (status) params['status'] = status;
    return firstValueFrom(
      this.http.get<{ claims: AdminReimbursement[] }>(this.base, { params }),
    ).then(r => r.claims);
  }

  approve(id: string, reviewNote?: string): Promise<AdminReimbursement> {
    return firstValueFrom(
      this.http.patch<{ claim: AdminReimbursement }>(`${this.base}/${id}/approve`, { reviewNote }),
    ).then(r => r.claim);
  }

  reject(id: string, reviewNote?: string): Promise<AdminReimbursement> {
    return firstValueFrom(
      this.http.patch<{ claim: AdminReimbursement }>(`${this.base}/${id}/reject`, { reviewNote }),
    ).then(r => r.claim);
  }
}
