import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateRolePayload, Role, UpdateRolePayload } from '../models/role.model';

// Deliberately always /admin/roles — role management has no /team scope
// equivalent, it's one of the hard invariants that's never delegable.
@Injectable({ providedIn: 'root' })
export class AdminRoleService {
  private readonly base = `${environment.apiUrl}/admin/roles`;

  constructor(private http: HttpClient) {}

  list(): Promise<Role[]> {
    return firstValueFrom(this.http.get<{ roles: Role[] }>(this.base)).then(r => r.roles);
  }

  create(payload: CreateRolePayload): Promise<Role> {
    return firstValueFrom(this.http.post<{ role: Role }>(this.base, payload)).then(r => r.role);
  }

  update(id: string, payload: UpdateRolePayload): Promise<Role> {
    return firstValueFrom(this.http.patch<{ role: Role }>(`${this.base}/${id}`, payload)).then(r => r.role);
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }
}
