import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminAuthGuard } from './core/guards/admin-auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
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
        path: 'leave',
        loadComponent: () =>
          import('./features/leave/leave.component').then(m => m.LeaveComponent),
      },
      {
        path: 'reimbursements',
        loadComponent: () =>
          import('./features/reimbursements/reimbursements.component').then(m => m.ReimbursementsComponent),
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
      {
        path: '',
        loadComponent: () =>
          import('./shared/superadmin-shell/superadmin-shell.component').then(m => m.SuperadminShellComponent),
        canActivate: [adminAuthGuard],
        children: [
          {
            path: '',
            redirectTo: 'employees',
            pathMatch: 'full',
          },
          {
            path: 'employees',
            loadComponent: () =>
              import('./features/superadmin/employees/superadmin-employees.component').then(m => m.SuperadminEmployeesComponent),
          },
          {
            path: 'tasks',
            loadComponent: () =>
              import('./features/superadmin/tasks/superadmin-tasks.component').then(m => m.SuperadminTasksComponent),
          },
          {
            path: 'reimbursements',
            loadComponent: () =>
              import('./features/superadmin/reimbursements/superadmin-reimbursements.component').then(m => m.SuperadminReimbursementsComponent),
          },
          {
            path: 'salary',
            loadComponent: () =>
              import('./features/superadmin/salary/superadmin-salary.component').then(m => m.SuperadminSalaryComponent),
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
