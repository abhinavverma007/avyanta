import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskService } from '../../core/services/task.service';
import { DailyTask, Installation } from '../../core/models/task.model';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss',
})
export class TasksComponent implements OnInit {
  readonly today = new Date();
  tasks = signal<DailyTask[]>([]);
  installations = signal<Installation[]>([]);

  readonly completedCount = computed(() =>
    this.tasks().filter(t => t.status === 'completed').length
  );
  readonly totalCount = computed(() => this.tasks().length);
  readonly percent = computed(() =>
    this.totalCount() ? Math.round((this.completedCount() / this.totalCount()) * 100) : 0
  );

  /* SVG ring: r=40, circumference = 2π*40 ≈ 251.2 */
  readonly circumference = 251.2;
  readonly ringOffset = computed(() =>
    this.circumference - (this.percent() / 100) * this.circumference
  );

  constructor(private taskService: TaskService) {}

  ngOnInit(): void {
    this.tasks.set(this.taskService.getTodayTasks());
    this.installations.set(this.taskService.getUpcomingInstallations());
  }

  toggleTask(id: string): void {
    this.tasks.update(tasks =>
      tasks.map(t =>
        t.id === id
          ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' }
          : t
      )
    );
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const diff = Math.floor((date.getTime() - this.today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return date.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  formatTodayHeader(): string {
    return this.today.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  typeIcon(type: string): string {
    const icons: Record<string, string> = {
      solar_panel:     '☀️',
      battery_storage: '🔋',
      inverter:        '⚡',
      site_inspection: '🔍',
      site_audit:      '📋',
      permit_review:   '📄',
      client_meeting:  '🤝',
    };
    return icons[type] ?? '🔧';
  }

  statusClass(status: string): string {
    const m: Record<string, string> = {
      completed:   'badge-success',
      in_progress: 'badge-info',
      pending:     'badge-warning',
      cancelled:   'badge-danger',
    };
    return m[status] ?? '';
  }

  statusLabel(status: string): string {
    const m: Record<string, string> = {
      completed:   'Done',
      in_progress: 'In Progress',
      pending:     'Upcoming',
      cancelled:   'Cancelled',
    };
    return m[status] ?? status;
  }
}
