import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminEmployee,
  CreateEmployeePayload,
  EmployeeWithGeneratedPassword,
  ListEmployeesParams,
  PaginatedEmployees,
  UpdateEmployeePayload,
} from '../models/admin.model';

@Injectable({ providedIn: 'root' })
export class AdminEmployeeService {
  private readonly base = `${environment.apiUrl}/admin/employees`;

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
