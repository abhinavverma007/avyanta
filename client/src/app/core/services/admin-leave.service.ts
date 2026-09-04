import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminLeave, LeaveStatus } from '../models/leave.model';

@Injectable({ providedIn: 'root' })
export class AdminLeaveService {
  private readonly base = `${environment.apiUrl}/admin/leaves`;

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
