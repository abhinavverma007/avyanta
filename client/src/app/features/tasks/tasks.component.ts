import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskService } from '../../core/services/task.service';
import { EmployeeTask, TaskRange } from '../../core/models/task.model';

const PAGE_SIZE = 3;

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss',
})
export class TasksComponent implements OnInit {
  readonly today = new Date();

  range = signal<TaskRange>('today');
  tasks = signal<EmployeeTask[]>([]);
  loading = signal(true);

  page = signal(1);
  totalPages = signal(1);
  total = signal(0);

  constructor(private taskService: TaskService) {}

  ngOnInit(): void {
    this.load();
  }

  setRange(range: TaskRange): void {
    if (this.range() === range) return;
    this.range.set(range);
    this.page.set(1);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.taskService.mine(this.range(), this.page(), PAGE_SIZE).then(res => {
      this.tasks.set(res.tasks);
      this.total.set(res.total);
      this.totalPages.set(res.totalPages);
      this.loading.set(false);
    });
  }

  prevPage(): void {
    if (this.page() <= 1) return;
    this.page.update(p => p - 1);
    this.load();
  }

  nextPage(): void {
    if (this.page() >= this.totalPages()) return;
    this.page.update(p => p + 1);
    this.load();
  }

  formatTodayHeader(): string {
    return this.today.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }

  emptyMessage(): string {
    if (this.range() === 'past') return 'No past work on record.';
    if (this.range() === 'upcoming') return 'No upcoming work assigned yet.';
    return 'No work assigned for today.';
  }

  coworkerNames(task: EmployeeTask): string {
    return task.coworkers.map(c => c.name).join(', ');
  }
}
