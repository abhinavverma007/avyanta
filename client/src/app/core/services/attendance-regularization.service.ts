import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApplyRegularizationPayload, PaginatedRegularizations, RegularizationRecord } from '../models/attendance-regularization.model';

@Injectable({ providedIn: 'root' })
export class AttendanceRegularizationService {
  private readonly base = `${environment.apiUrl}/regularizations`;

  constructor(private http: HttpClient) {}

  mine(page = 1, limit = 10): Promise<PaginatedRegularizations> {
    return firstValueFrom(
      this.http.get<PaginatedRegularizations>(`${this.base}/mine`, { params: { page, limit } }),
    );
  }

  apply(payload: ApplyRegularizationPayload): Promise<RegularizationRecord> {
    return firstValueFrom(this.http.post<{ request: RegularizationRecord }>(this.base, payload)).then(r => r.request);
  }
}
