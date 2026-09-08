import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EmployeeTask, PaginatedTasks, TaskRange, TaskStatus } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly base = `${environment.apiUrl}/tasks`;

  constructor(private http: HttpClient) {}

  mine(range: TaskRange, page = 1, limit = 10): Promise<PaginatedTasks> {
    return firstValueFrom(
      this.http.get<PaginatedTasks>(`${this.base}/mine`, { params: { range, page, limit } }),
    );
  }

  updateStatus(id: string, status: TaskStatus): Promise<EmployeeTask> {
    return firstValueFrom(this.http.patch<{ task: EmployeeTask }>(`${this.base}/${id}/status`, { status })).then(r => r.task);
  }

  addNote(id: string, text: string): Promise<EmployeeTask> {
    return firstValueFrom(this.http.post<{ task: EmployeeTask }>(`${this.base}/${id}/notes`, { text })).then(r => r.task);
  }
}
