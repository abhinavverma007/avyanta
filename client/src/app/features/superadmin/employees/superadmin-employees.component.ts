import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AdminEmployeeService } from '../../../core/services/admin-employee.service';
import { AdminEmployee } from '../../../core/models/admin.model';
import { API_SCOPE } from '../../../core/tokens/api-scope';

// Card view (mobile) only shows Name + Status until tapped (see the
// template), so 10 fit per page without feeling cramped — higher than this
// app's usual page size of 3. The desktop table shares this same
// server-paginated list and stays comfortably readable at 10 rows too.
const PAGE_SIZE = 10;

@Component({
  selector: 'app-superadmin-employees',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './superadmin-employees.component.html',
  styleUrl: './superadmin-employees.component.scss',
})
export class SuperadminEmployeesComponent implements OnInit {
  employees = signal<AdminEmployee[]>([]);
  loading = signal(true);

  search = signal('');
  page = signal(1);
  totalPages = signal(1);
  total = signal(0);
  private searchDebounce?: ReturnType<typeof setTimeout>;

  credentialBanner = signal<{ name: string; email: string; password: string } | null>(null);
  resettingId = signal<string | null>(null);

  // Which employee's card is expanded — mobile card view only (see template);
  // the desktop table already shows everything in one compact row.
  expandedId = signal<string | null>(null);

  // Whether this instance is rendering the true owner's session (API_SCOPE
  // 'admin') or a permission-delegated Supervisor/Manager's (API_SCOPE
  // 'team', same route — see app.routes.ts) — creating an employee,
  // resetting a password, activating/deactivating, and assigning roles are
  // hard invariants that only ever show up in admin scope (the backend
  // enforces this too, see adminEmployees.routes.js — this is purely about
  // not showing controls that would just 403 anyway).
  readonly isAdminScope = inject(API_SCOPE) === 'admin';

  constructor(
    private employeeService: AdminEmployeeService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.load();

    // Passed via router state from the Add Employee page right after a
    // successful create — a one-off, sensitive value, so it travels in nav
    // state (never a query param/URL) and is read exactly once here.
    const credential = (history.state as { credential?: { name: string; email: string; password: string } })?.credential;
    if (credential) this.credentialBanner.set(credential);
  }

  load(): void {
    this.loading.set(true);
    this.expandedId.set(null);
    this.employeeService
      .list({ search: this.search(), page: this.page(), limit: PAGE_SIZE })
      .then(res => {
        this.employees.set(res.employees);
        this.total.set(res.total);
        this.totalPages.set(res.totalPages);
        this.loading.set(false);
      });
  }

  toggleExpand(id: string): void {
    this.expandedId.update(cur => (cur === id ? null : id));
  }

  onSearchInput(value: string): void {
    this.search.set(value);
    this.page.set(1);
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.load(), 300);
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

  openCreateForm(): void {
    this.router.navigate(['/superadmin/employees/new']);
  }

  openEditForm(emp: AdminEmployee): void {
    this.router.navigate(['/superadmin/employees', emp.id, 'edit']);
  }

  async resetPassword(emp: AdminEmployee): Promise<void> {
    this.resettingId.set(emp.id);
    try {
      const res = await this.employeeService.resetPassword(emp.id);
      this.credentialBanner.set({ name: res.employee.name, email: res.employee.email, password: res.generatedPassword });
    } finally {
      this.resettingId.set(null);
    }
  }

  async toggleActive(emp: AdminEmployee): Promise<void> {
    await this.employeeService.update(emp.id, { isActive: !emp.isActive });
    this.load();
  }

  dismissBanner(): void {
    this.credentialBanner.set(null);
  }

  // Same route serves both a true Admin and a delegated Supervisor/Manager
  // now (see app.routes.ts) — API_SCOPE decides which backend it calls, not
  // which frontend path it's reached at.
  attendanceHistoryPath(employeeId: string): string[] {
    return ['/superadmin/employees', employeeId, 'attendance'];
  }

  async copyPassword(password: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(password);
    } catch {
      // clipboard access can be blocked; password is still visible on screen to copy manually
    }
  }
}
