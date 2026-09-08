import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../core/services/task.service';
import { PushNotificationService } from '../../core/services/push-notification.service';
import { EmployeeTask, TaskRange, TaskStatus } from '../../core/models/task.model';
import { LocationPickerComponent } from '../../shared/components/location-picker/location-picker.component';
import { googleMapsDirectionsUrl } from '../../shared/utils/maps-link';
import { istDateString } from '../../shared/utils/ist-date';

const PAGE_SIZE = 3;
const PUSH_BANNER_DISMISSED_KEY = 'sundesh_push_banner_dismissed';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, LocationPickerComponent],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss',
})
export class TasksComponent implements OnInit {
  readonly today = new Date();

  // A row of tabs stops scaling once there are more of them than fit on a
  // narrow screen — below 640px this becomes a plain <select> instead (see
  // .section-select in the scss), same pattern as Requests/Approvals.
  readonly rangeOptions: { value: TaskRange; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'past', label: 'Past Work' },
    { value: 'today', label: "Today's Work" },
    { value: 'upcoming', label: 'Upcoming Work' },
  ];

  range = signal<TaskRange>('today');
  tasks = signal<EmployeeTask[]>([]);
  loading = signal(true);
  updatingTaskId = signal<string | null>(null);
  // Must match the backend's IST-based "today" (server/src/utils/istDate.js)
  // — a browser-local/UTC date string sits a full calendar day behind IST
  // for part of the night, which would otherwise hide Start Work for a task
  // genuinely dated "today".
  private readonly todayStr = istDateString();

  page = signal(1);
  totalPages = signal(1);
  total = signal(0);

  notifPermission = signal<NotificationPermission | 'unsupported'>('unsupported');
  pushBannerDismissed = signal(localStorage.getItem(PUSH_BANNER_DISMISSED_KEY) === '1');
  enablingPush = signal(false);

  noteDraftTaskId = signal<string | null>(null);
  noteDraftText = signal('');
  submittingNote = signal(false);
  noteError = signal('');

  constructor(
    private taskService: TaskService,
    private pushNotification: PushNotificationService,
  ) {}

  ngOnInit(): void {
    this.load();
    this.notifPermission.set(this.pushNotification.permission());
  }

  showPushBanner(): boolean {
    return this.notifPermission() === 'default' && !this.pushBannerDismissed();
  }

  async enablePush(): Promise<void> {
    this.enablingPush.set(true);
    try {
      await this.pushNotification.subscribe();
    } finally {
      this.notifPermission.set(this.pushNotification.permission());
      this.enablingPush.set(false);
    }
  }

  dismissPushBanner(): void {
    localStorage.setItem(PUSH_BANNER_DISMISSED_KEY, '1');
    this.pushBannerDismissed.set(true);
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
    if (this.range() === 'all') return 'No work assigned yet.';
    if (this.range() === 'past') return 'No past work on record.';
    if (this.range() === 'upcoming') return 'No upcoming work assigned yet.';
    return 'No work assigned for today.';
  }

  coworkerNames(task: EmployeeTask): string {
    return task.coworkers.map(c => c.name).join(', ');
  }

  directionsUrl(task: EmployeeTask): string {
    return task.siteLocation ? googleMapsDirectionsUrl(task.siteLocation) : '';
  }

  statusLabel(status: TaskStatus): string {
    if (status === 'completed') return 'Completed';
    if (status === 'in_progress') return 'In Progress';
    return 'Pending';
  }

  statusBadgeClass(status: TaskStatus): string {
    if (status === 'completed') return 'badge-success';
    if (status === 'in_progress') return 'badge-info';
    return 'badge-warning';
  }

  // A task can't be started or finished before its own date — only lets the
  // owner see it as "pending" until then.
  canUpdateStatus(task: EmployeeTask): boolean {
    return task.date <= this.todayStr;
  }

  async setStatus(task: EmployeeTask, status: TaskStatus): Promise<void> {
    this.updatingTaskId.set(task.id);
    try {
      const updated = await this.taskService.updateStatus(task.id, status);
      this.tasks.update(list => list.map(t => (t.id === task.id ? updated : t)));
    } finally {
      this.updatingTaskId.set(null);
    }
  }

  isComposingNote(taskId: string): boolean {
    return this.noteDraftTaskId() === taskId;
  }

  openNoteComposer(task: EmployeeTask): void {
    this.noteDraftTaskId.set(task.id);
    this.noteDraftText.set('');
    this.noteError.set('');
  }

  cancelNoteComposer(): void {
    this.noteDraftTaskId.set(null);
    this.noteDraftText.set('');
    this.noteError.set('');
  }

  async submitNote(task: EmployeeTask): Promise<void> {
    const text = this.noteDraftText().trim();
    if (!text) {
      this.noteError.set('Write something before sending.');
      return;
    }
    this.submittingNote.set(true);
    this.noteError.set('');
    try {
      const updated = await this.taskService.addNote(task.id, text);
      this.tasks.update(list => list.map(t => (t.id === task.id ? updated : t)));
      this.cancelNoteComposer();
    } catch (err: any) {
      this.noteError.set(err?.error?.message ?? 'Could not send that note. Please try again.');
    } finally {
      this.submittingNote.set(false);
    }
  }

  formatNoteTime(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
  }
}
