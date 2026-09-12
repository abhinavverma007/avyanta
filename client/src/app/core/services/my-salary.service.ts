import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SalaryDetail } from '../models/reimbursement.model';

// Employee-facing, read-only — always the caller's own record (see
// salary.self.routes.js, which takes no :employeeId at all). Unlike the
// Admin*Service family this doesn't need API_SCOPE or a per-route provider:
// there's only ever one scope here, the plain employee token.
@Injectable({ providedIn: 'root' })
export class MySalaryService {
  private readonly base = `${environment.apiUrl}/salary`;

  constructor(private http: HttpClient) {}

  detail(year: number, month: number): Promise<SalaryDetail> {
    return firstValueFrom(this.http.get<SalaryDetail>(this.base, { params: { year, month } }));
  }
}
