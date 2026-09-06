import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_SCOPE } from '../tokens/api-scope';
import {
  AdminEmployee,
  CreateEmployeePayload,
  EmployeeWithGeneratedPassword,
  ListEmployeesParams,
  PaginatedEmployees,
  UpdateEmployeePayload,
} from '../models/admin.model';

// Deliberately NOT providedIn: 'root' — this reads API_SCOPE once in its
// constructor, and a root singleton is only ever constructed the *first*
// time anything injects it, permanently freezing whatever scope was active
// then. Provided fresh per-route instead (see app.routes.ts) so it always
// picks up the *current* session's scope, not a stale one from earlier in
// the same tab (this was a real bug: a Supervisor session reused an Admin-
// scoped instance built earlier in the same browser tab).
@Injectable()
export class AdminEmployeeService {
  private readonly scope = inject(API_SCOPE);
  private readonly base = `${environment.apiUrl}/${this.scope}/employees`;

  constructor(private http: HttpClient) {}

  list(params: ListEmployeesParams = {}): Promise<PaginatedEmployees> {
    const query: Record<string, string> = {};
    if (params.search) query['search'] = params.search;
    if (params.page) query['page'] = String(params.page);
    if (params.limit) query['limit'] = String(params.limit);
    return firstValueFrom(this.http.get<PaginatedEmployees>(this.base, { params: query }));
  }

  get(id: string): Promise<AdminEmployee> {
    return firstValueFrom(
      this.http.get<{ employee: AdminEmployee }>(`${this.base}/${id}`),
    ).then(r => r.employee);
  }

  create(payload: CreateEmployeePayload): Promise<EmployeeWithGeneratedPassword> {
    return firstValueFrom(this.http.post<EmployeeWithGeneratedPassword>(this.base, payload));
  }

  previewEmail(name: string): Promise<string> {
    return firstValueFrom(
      this.http.get<{ email: string }>(`${this.base}/preview-email`, { params: { name } }),
    ).then(r => r.email);
  }

  update(id: string, payload: UpdateEmployeePayload): Promise<AdminEmployee> {
    return firstValueFrom(
      this.http.patch<{ employee: AdminEmployee }>(`${this.base}/${id}`, payload),
    ).then(r => r.employee);
  }

  resetPassword(id: string, password?: string): Promise<EmployeeWithGeneratedPassword> {
    return firstValueFrom(
      this.http.post<EmployeeWithGeneratedPassword>(`${this.base}/${id}/reset-password`, password ? { password } : {}),
    );
  }
}
