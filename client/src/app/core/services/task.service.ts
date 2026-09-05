import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaginatedTasks, TaskRange } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly base = `${environment.apiUrl}/tasks`;

  constructor(private http: HttpClient) {}

  mine(range: TaskRange, page = 1, limit = 10): Promise<PaginatedTasks> {
    return firstValueFrom(
      this.http.get<PaginatedTasks>(`${this.base}/mine`, { params: { range, page, limit } }),
    );
  }
}
