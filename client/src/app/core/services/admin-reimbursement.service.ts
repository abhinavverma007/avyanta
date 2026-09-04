import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminReimbursement, ReimbursementStatus } from '../models/reimbursement.model';

@Injectable({ providedIn: 'root' })
export class AdminReimbursementService {
  private readonly base = `${environment.apiUrl}/admin/reimbursements`;

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
