import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SalaryDetail, SalarySummary } from '../models/reimbursement.model';

@Injectable({ providedIn: 'root' })
export class SalaryService {
  private readonly base = `${environment.apiUrl}/admin/salary`;

  constructor(private http: HttpClient) {}

  summary(year: number, month: number): Promise<SalarySummary> {
    return firstValueFrom(this.http.get<SalarySummary>(this.base, { params: { year, month } }));
  }

  detail(employeeId: string, year: number, month: number): Promise<SalaryDetail> {
    return firstValueFrom(
      this.http.get<SalaryDetail>(`${this.base}/${employeeId}`, { params: { year, month } }),
    );
  }
}
