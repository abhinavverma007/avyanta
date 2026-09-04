import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TodayTask } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly base = `${environment.apiUrl}/tasks`;

  constructor(private http: HttpClient) {}

  // Deliberately today-only — the backend never returns upcoming tasks here.
  today(): Promise<TodayTask[]> {
    return firstValueFrom(
      this.http.get<{ date: string; tasks: TodayTask[] }>(`${this.base}/today`),
    ).then(r => r.tasks);
  }
}
