import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminTask, CreateTaskPayload, ListTasksParams, PaginatedTasks } from '../models/admin-task.model';

@Injectable({ providedIn: 'root' })
export class AdminTaskService {
  private readonly base = `${environment.apiUrl}/admin/tasks`;

  constructor(private http: HttpClient) {}

  list(params: ListTasksParams = {}): Promise<PaginatedTasks> {
    const query: Record<string, string> = {};
    if (params.date) query['date'] = params.date;
    if (params.employeeId) query['employeeId'] = params.employeeId;
    if (params.page) query['page'] = String(params.page);
    if (params.limit) query['limit'] = String(params.limit);
    return firstValueFrom(this.http.get<PaginatedTasks>(this.base, { params: query }));
  }

  create(payload: CreateTaskPayload): Promise<AdminTask[]> {
    return firstValueFrom(this.http.post<{ tasks: AdminTask[] }>(this.base, payload)).then(r => r.tasks);
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }
}
