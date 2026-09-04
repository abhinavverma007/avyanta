import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminRegularization, RegularizationStatus } from '../models/attendance-regularization.model';

@Injectable({ providedIn: 'root' })
export class AdminAttendanceRegularizationService {
  private readonly base = `${environment.apiUrl}/admin/regularizations`;

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
