import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminTaskService } from '../../../core/services/admin-task.service';
import { AdminEmployeeService } from '../../../core/services/admin-employee.service';
import { AdminTask, TaskStatus } from '../../../core/models/admin-task.model';
import { AdminEmployee } from '../../../core/models/admin.model';
import { LocationPickerComponent } from '../../../shared/components/location-picker/location-picker.component';
import { googleMapsDirectionsUrl } from '../../../shared/utils/maps-link';

const PAGE_SIZE = 10;
const EMPLOYEE_SEARCH_LIMIT = 8;

@Component({
  selector: 'app-superadmin-tasks',
  standalone: true,
  imports: [CommonModule, LocationPickerComponent],
  templateUrl: './superadmin-tasks.component.html',
  styleUrl: './superadmin-tasks.component.scss',
})
export class SuperadminTasksComponent implements OnInit {
  tasks = signal<AdminTask[]>([]);
  loading = signal(true);

  page = signal(1);
  totalPages = signal(1);
  total = signal(0);
  filterDate = signal('');
  filterStatus = signal<TaskStatus | ''>('');
  filterSearch = signal('');
  filterEmployee = signal<AdminEmployee | null>(null);

  readonly hasActiveFilters = computed(
    () => !!(this.filterDate() || this.filterStatus() || this.filterSearch() || this.filterEmployee()),
  );

  readonly statusOptions: { value: TaskStatus; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
  ];

  // Employee filter — search-driven so this stays usable with hundreds of
  // employees, same pattern as the Assign Task employee picker, but
  // single-select since it's a filter, not an assignment list.
  employeeFilterQuery = signal('');
  employeeFilterResults = signal<AdminEmployee[]>([]);
  employeeFilterLoading = signal(false);
  showEmployeeFilterResults = signal(false);
  private employeeFilterDebounce?: ReturnType<typeof setTimeout>;
  private filterSearchDebounce?: ReturnType<typeof setTimeout>;

  constructor(
    private taskService: AdminTaskService,
    private employeeService: AdminEmployeeService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadTasks();
  }

  loadTasks(): void {
    this.loading.set(true);
    this.taskService
      .list({
        date: this.filterDate() || undefined,
        status: this.filterStatus() || undefined,
        search: this.filterSearch() || undefined,
        employeeId: this.filterEmployee()?.id || undefined,
        page: this.page(),
        limit: PAGE_SIZE,
      })
      .then(res => {
        this.tasks.set(res.tasks);
        this.total.set(res.total);
        this.totalPages.set(res.totalPages);
        this.loading.set(false);
      });
  }

  onFilterDateChange(value: string): void {
    this.filterDate.set(value);
    this.page.set(1);
    this.loadTasks();
  }

  onFilterSearchInput(value: string): void {
    this.filterSearch.set(value);
    clearTimeout(this.filterSearchDebounce);
    this.filterSearchDebounce = setTimeout(() => {
      this.page.set(1);
      this.loadTasks();
    }, 300);
  }

  clearFilter(): void {
    clearTimeout(this.filterSearchDebounce);
    this.filterDate.set('');
    this.filterStatus.set('');
    this.filterSearch.set('');
    this.filterEmployee.set(null);
    this.employeeFilterQuery.set('');
    this.page.set(1);
    this.loadTasks();
  }

  onFilterStatusChange(value: TaskStatus | ''): void {
    this.filterStatus.set(value);
    this.page.set(1);
    this.loadTasks();
  }

  onEmployeeFilterInput(value: string): void {
    this.employeeFilterQuery.set(value);
    this.showEmployeeFilterResults.set(true);
    clearTimeout(this.employeeFilterDebounce);
    this.employeeFilterLoading.set(true);
    this.employeeFilterDebounce = setTimeout(() => {
      this.employeeService.list({ search: value, limit: EMPLOYEE_SEARCH_LIMIT }).then(res => {
        this.employeeFilterResults.set(res.employees);
        this.employeeFilterLoading.set(false);
      });
    }, 300);
  }

  selectEmployeeFilter(emp: AdminEmployee): void {
    this.filterEmployee.set(emp);
    this.employeeFilterQuery.set('');
    this.showEmployeeFilterResults.set(false);
    this.page.set(1);
    this.loadTasks();
  }

  clearEmployeeFilter(): void {
    this.filterEmployee.set(null);
    this.page.set(1);
    this.loadTasks();
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

  prevPage(): void {
    if (this.page() <= 1) return;
    this.page.update(p => p - 1);
    this.loadTasks();
  }

  nextPage(): void {
    if (this.page() >= this.totalPages()) return;
    this.page.update(p => p + 1);
    this.loadTasks();
  }

  openForm(): void {
    this.router.navigate(['/superadmin/tasks/new']);
  }

  openEditForm(task: AdminTask): void {
    this.router.navigate(['/superadmin/tasks', task.id, 'edit']);
  }

  directionsUrl(task: AdminTask): string {
    return task.siteLocation ? googleMapsDirectionsUrl(task.siteLocation) : '';
  }

  expandedNotesTaskId = signal<string | null>(null);

  toggleNotes(taskId: string): void {
    this.expandedNotesTaskId.update(current => (current === taskId ? null : taskId));
  }

  formatNoteTime(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
  }

  async deleteTask(task: AdminTask): Promise<void> {
    await this.taskService.remove(task.id);
    this.loadTasks();
  }
}
