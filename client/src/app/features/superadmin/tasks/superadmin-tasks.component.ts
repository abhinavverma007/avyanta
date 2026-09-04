import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminTaskService } from '../../../core/services/admin-task.service';
import { AdminEmployeeService } from '../../../core/services/admin-employee.service';
import { AdminTask } from '../../../core/models/admin-task.model';
import { AdminEmployee } from '../../../core/models/admin.model';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function datesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const start = new Date(from);
  const end = new Date(to);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return dates;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

const PAGE_SIZE = 10;
const EMPLOYEE_SEARCH_LIMIT = 20;

@Component({
  selector: 'app-superadmin-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  showForm = signal(false);
  title = signal('');
  description = signal('');
  site = signal('');
  fromDate = signal(todayStr());
  toDate = signal(todayStr());
  saving = signal(false);
  formError = signal('');
  formSuccess = signal('');

  // Employee picker — search-driven so this stays usable with hundreds of
  // employees: only a small filtered page is ever loaded, and selections
  // (kept as full records, not just ids) are shown as chips so they stay
  // visible even after the search results change.
  employeeSearch = signal('');
  employeeResults = signal<AdminEmployee[]>([]);
  employeeSearchLoading = signal(false);
  selectedEmployees = signal<Map<string, AdminEmployee>>(new Map());
  private employeeSearchDebounce?: ReturnType<typeof setTimeout>;

  readonly selectedDates = computed(() => datesInRange(this.fromDate(), this.toDate()));
  readonly selectedEmployeeList = computed(() => Array.from(this.selectedEmployees().values()));

  constructor(
    private taskService: AdminTaskService,
    private employeeService: AdminEmployeeService,
  ) {}

  ngOnInit(): void {
    this.loadTasks();
  }

  loadTasks(): void {
    this.loading.set(true);
    this.taskService
      .list({ date: this.filterDate() || undefined, page: this.page(), limit: PAGE_SIZE })
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

  clearFilter(): void {
    this.filterDate.set('');
    this.page.set(1);
    this.loadTasks();
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
    this.showForm.set(true);
    this.title.set('');
    this.description.set('');
    this.site.set('');
    this.fromDate.set(todayStr());
    this.toDate.set(todayStr());
    this.selectedEmployees.set(new Map());
    this.employeeSearch.set('');
    this.formError.set('');
    this.formSuccess.set('');
    this.searchEmployees('');
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  onEmployeeSearchInput(value: string): void {
    this.employeeSearch.set(value);
    clearTimeout(this.employeeSearchDebounce);
    this.employeeSearchLoading.set(true);
    this.employeeSearchDebounce = setTimeout(() => this.searchEmployees(value), 300);
  }

  private searchEmployees(search: string): void {
    this.employeeService.list({ search, limit: EMPLOYEE_SEARCH_LIMIT }).then(res => {
      this.employeeResults.set(res.employees.filter(e => e.isActive));
      this.employeeSearchLoading.set(false);
    });
  }

  toggleEmployee(emp: AdminEmployee): void {
    this.selectedEmployees.update(map => {
      const next = new Map(map);
      if (next.has(emp.id)) next.delete(emp.id);
      else next.set(emp.id, emp);
      return next;
    });
  }

  removeSelectedEmployee(id: string): void {
    this.selectedEmployees.update(map => {
      const next = new Map(map);
      next.delete(id);
      return next;
    });
  }

  isSelected(id: string): boolean {
    return this.selectedEmployees().has(id);
  }

  async submitForm(): Promise<void> {
    this.formError.set('');
    this.formSuccess.set('');

    if (!this.title().trim()) {
      this.formError.set('Title is required.');
      return;
    }
    const dates = this.selectedDates();
    if (dates.length === 0) {
      this.formError.set('Pick a valid date range.');
      return;
    }
    const employeeIds = Array.from(this.selectedEmployees().keys());
    if (employeeIds.length === 0) {
      this.formError.set('Select at least one employee.');
      return;
    }

    this.saving.set(true);
    try {
      await this.taskService.create({
        title: this.title(),
        description: this.description(),
        site: this.site(),
        dates,
        employeeIds,
      });
      this.formSuccess.set(
        `Assigned for ${dates.length} day${dates.length === 1 ? '' : 's'} to ${employeeIds.length} employee${employeeIds.length === 1 ? '' : 's'}.`,
      );
      this.page.set(1);
      this.loadTasks();
    } catch (err: any) {
      this.formError.set(err?.error?.message ?? 'Could not assign task. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

  async deleteTask(task: AdminTask): Promise<void> {
    await this.taskService.remove(task.id);
    this.loadTasks();
  }
}
