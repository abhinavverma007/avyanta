import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminAuthGuard } from './core/guards/admin-auth.guard';
import { superadminShellGuard, superadminAreaGuard, anySuperadminAreaGuard } from './core/guards/superadmin-area.guard';
import { AdminAuthService } from './core/services/admin-auth.service';
import { API_SCOPE } from './core/tokens/api-scope';
import { AdminEmployeeService } from './core/services/admin-employee.service';
import { AdminAttendanceService } from './core/services/admin-attendance.service';
import { AdminTaskService } from './core/services/admin-task.service';
import { AdminReimbursementService } from './core/services/admin-reimbursement.service';
import { AdminLeaveService } from './core/services/admin-leave.service';
import { AdminAttendanceRegularizationService } from './core/services/admin-attendance-regularization.service';
import { AdminSalaryAdvanceService } from './core/services/admin-salary-advance.service';
import { SalaryService } from './core/services/salary.service';

// Re-evaluated on every navigation into one of these child routes (not just
// once when /superadmin is first entered) — a sibling route swap under the
// same shell always destroys and recreates the child's injector, so this
// factory runs fresh each time, always reflecting AdminAuthService's
// *current* state rather than a stale snapshot from whenever the shell
// itself first mounted.
const apiScopeProvider = {
  provide: API_SCOPE,
  useFactory: () => (inject(AdminAuthService).isAuthenticated() ? 'admin' : 'team'),
} as const;

// The Admin*Service classes each read API_SCOPE once in their own
// constructor — listing them here (not providedIn: 'root') means a *new*
// instance is built every time its route activates, so it always sees the
// *current* scope. Without this, whichever scope was active the first time
// any of these was ever injected in the tab got frozen in forever (root
// singletons are constructed once and never rebuilt) — this was a real bug:
// a Supervisor session reused an Admin-scoped instance built earlier in the
// same tab and got stuck 401-looping against /admin/* forever.

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  // ── Plain employee experience ──────────────────────────────────────
  // Every employee — including a Supervisor/Manager — sees exactly the same
  // simple view here: their own attendance, requests and assigned tasks.
  // Delegated management access (if any) lives entirely under /superadmin
  // instead (see below) — this tree never shows "Team:" management screens.
  {
    path: '',
    loadComponent: () =>
      import('./shared/shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'attendance',
        loadComponent: () =>
          import('./features/attendance/attendance.component').then(m => m.AttendanceComponent),
      },
      {
        path: 'requests',
        loadComponent: () =>
          import('./features/requests/requests.component').then(m => m.RequestsComponent),
      },
      {
        path: 'tasks',
        loadComponent: () =>
          import('./features/tasks/tasks.component').then(m => m.TasksComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.component').then(m => m.ProfileComponent),
      },
    ],
  },
  {
    path: 'superadmin',
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/superadmin/login/superadmin-login.component').then(m => m.SuperadminLoginComponent),
      },
      // ── Management console — shared by the true owner AND a delegated
      // Supervisor/Manager, both logging in right here at /superadmin ────
      // Same shell, same Superadmin*Components either way; API_SCOPE
      // decides which backend routes get called (/admin/* for a real
      // Admin session, /team/* — permission-gated — for an Employee
      // session), and each child route below gates on the specific
      // permission it needs (a true Admin bypasses all of them; see
      // superadmin-area.guard.ts). Roles and the Audit Log stay strictly
      // adminAuthGuard-only — never reachable by a delegated session,
      // matching the backend's hard invariant in requirePermission.js.
      {
        path: '',
        loadComponent: () =>
          import('./shared/superadmin-shell/superadmin-shell.component').then(m => m.SuperadminShellComponent),
        canActivate: [superadminShellGuard],
        children: [
          {
            path: '',
            redirectTo: 'employees',
            pathMatch: 'full',
          },
          {
            path: 'employees',
            providers: [apiScopeProvider, AdminEmployeeService],
            canActivate: [superadminAreaGuard('employees')],
            loadComponent: () =>
              import('./features/superadmin/employees/superadmin-employees.component').then(m => m.SuperadminEmployeesComponent),
          },
          {
            path: 'employees/:id/attendance',
            providers: [apiScopeProvider, AdminAttendanceService],
            canActivate: [superadminAreaGuard('employees')],
            loadComponent: () =>
              import('./features/superadmin/employee-attendance/superadmin-employee-attendance.component').then(m => m.SuperadminEmployeeAttendanceComponent),
          },
          {
            path: 'tasks',
            // AdminEmployeeService too — the "Assign Task" form's employee
            // picker (superadmin-tasks.component.ts) uses it directly.
            providers: [apiScopeProvider, AdminTaskService, AdminEmployeeService],
            canActivate: [superadminAreaGuard('tasks')],
            loadComponent: () =>
              import('./features/superadmin/tasks/superadmin-tasks.component').then(m => m.SuperadminTasksComponent),
          },
          {
            path: 'approvals',
            providers: [
              apiScopeProvider,
              AdminReimbursementService,
              AdminLeaveService,
              AdminAttendanceRegularizationService,
              AdminSalaryAdvanceService,
            ],
            canActivate: [anySuperadminAreaGuard(['approvalsReimbursements', 'approvalsLeave', 'approvalsRegularization', 'approvalsAdvance'])],
            loadComponent: () =>
              import('./features/superadmin/approvals/superadmin-approvals.component').then(m => m.SuperadminApprovalsComponent),
          },
          {
            path: 'salary',
            providers: [apiScopeProvider, SalaryService],
            canActivate: [superadminAreaGuard('salary')],
            loadComponent: () =>
              import('./features/superadmin/salary/superadmin-salary.component').then(m => m.SuperadminSalaryComponent),
          },
          {
            path: 'roles',
            canActivate: [adminAuthGuard],
            loadComponent: () =>
              import('./features/superadmin/roles/superadmin-roles.component').then(m => m.SuperadminRolesComponent),
          },
          {
            path: 'audit-log',
            canActivate: [adminAuthGuard],
            loadComponent: () =>
              import('./features/superadmin/audit-log/superadmin-audit-log.component').then(m => m.SuperadminAuditLogComponent),
          },
        ],
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
