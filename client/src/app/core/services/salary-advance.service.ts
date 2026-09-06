import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApplyAdvancePayload, SalaryAdvanceRequest } from '../models/salary-advance.model';

@Injectable({ providedIn: 'root' })
export class SalaryAdvanceService {
  private readonly base = `${environment.apiUrl}/advances`;

  constructor(private http: HttpClient) {}

  mine(): Promise<SalaryAdvanceRequest[]> {
    return firstValueFrom(this.http.get<{ requests: SalaryAdvanceRequest[] }>(`${this.base}/mine`)).then(r => r.requests);
  }

  apply(payload: ApplyAdvancePayload): Promise<SalaryAdvanceRequest> {
    return firstValueFrom(this.http.post<{ request: SalaryAdvanceRequest }>(this.base, payload)).then(r => r.request);
  }
}
