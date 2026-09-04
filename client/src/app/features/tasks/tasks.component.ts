import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskService } from '../../core/services/task.service';
import { TodayTask } from '../../core/models/task.model';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss',
})
export class TasksComponent implements OnInit {
  readonly today = new Date();
  tasks = signal<TodayTask[]>([]);
  loading = signal(true);

  constructor(private taskService: TaskService) {}

  ngOnInit(): void {
    this.taskService.today().then(tasks => {
      this.tasks.set(tasks);
      this.loading.set(false);
    });
  }

  formatTodayHeader(): string {
    return this.today.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  coworkerNames(task: TodayTask): string {
    return task.coworkers.map(c => c.name).join(', ');
  }
}
