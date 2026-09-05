import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SalaryDetail, SalaryRow, SalarySummary } from '../models/reimbursement.model';

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

  // Returns the recomputed row (payable/balance etc.) — not the full detail
  // (no reimbursements/payouts list); re-fetch detail() after this if that's
  // being displayed.
  recordPayout(employeeId: string, year: number, month: number, amount: number, note?: string): Promise<SalaryRow> {
    return firstValueFrom(
      this.http.post<{ salary: SalaryRow }>(`${this.base}/${employeeId}/pay`, { year, month, amount, note }),
    ).then(r => r.salary);
  }
}
