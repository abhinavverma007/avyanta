import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuditLogFilters, PaginatedAuditLog } from '../models/audit-log.model';

// Admin-only, no /team scope — a delegated Supervisor/Manager must never be
// able to read what anyone (including themselves) did on the owner's behalf.
@Injectable({ providedIn: 'root' })
export class AdminAuditLogService {
  private readonly base = `${environment.apiUrl}/admin/audit-logs`;

  constructor(private http: HttpClient) {}

  list(filters: AuditLogFilters = {}): Promise<PaginatedAuditLog> {
    const params: Record<string, string> = {};
    if (filters.actorId) params['actorId'] = filters.actorId;
    if (filters.action) params['action'] = filters.action;
    if (filters.resourceType) params['resourceType'] = filters.resourceType;
    if (filters.from) params['from'] = filters.from;
    if (filters.to) params['to'] = filters.to;
    if (filters.page) params['page'] = String(filters.page);
    if (filters.limit) params['limit'] = String(filters.limit);
    return firstValueFrom(this.http.get<PaginatedAuditLog>(this.base, { params }));
  }
}
