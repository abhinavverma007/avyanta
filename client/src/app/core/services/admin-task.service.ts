import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_SCOPE } from '../tokens/api-scope';
import { AdminTask, CreateTaskPayload, ListTasksParams, PaginatedTasks, UpdateTaskPayload } from '../models/admin-task.model';

// Not providedIn: 'root' — provided fresh per-route instead so it always
// re-reads the current session's API_SCOPE (see admin-employee.service.ts
// for the full explanation, and app.routes.ts for where it's provided).
@Injectable()
export class AdminTaskService {
  private readonly scope = inject(API_SCOPE);
  private readonly base = `${environment.apiUrl}/${this.scope}/tasks`;

  constructor(private http: HttpClient) {}

  list(params: ListTasksParams = {}): Promise<PaginatedTasks> {
    const query: Record<string, string> = {};
    if (params.date) query['date'] = params.date;
    if (params.employeeId) query['employeeId'] = params.employeeId;
    if (params.status) query['status'] = params.status;
    if (params.search) query['search'] = params.search;
    if (params.page) query['page'] = String(params.page);
    if (params.limit) query['limit'] = String(params.limit);
    return firstValueFrom(this.http.get<PaginatedTasks>(this.base, { params: query }));
  }

  get(id: string): Promise<AdminTask> {
    return firstValueFrom(this.http.get<{ task: AdminTask }>(`${this.base}/${id}`)).then(r => r.task);
  }

  create(payload: CreateTaskPayload): Promise<AdminTask[]> {
    return firstValueFrom(this.http.post<{ tasks: AdminTask[] }>(this.base, payload)).then(r => r.tasks);
  }

  update(id: string, payload: UpdateTaskPayload): Promise<AdminTask> {
    return firstValueFrom(this.http.patch<{ task: AdminTask }>(`${this.base}/${id}`, payload)).then(r => r.task);
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }
}
