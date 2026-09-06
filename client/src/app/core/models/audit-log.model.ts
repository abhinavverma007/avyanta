export interface AuditLogEntry {
  id: string;
  actorType: 'admin' | 'employee';
  actorId: string;
  actorName: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogFilters {
  actorId?: string;
  action?: string;
  resourceType?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedAuditLog {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
