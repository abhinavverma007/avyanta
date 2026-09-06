import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth.service';
import { AuthService } from '../services/auth.service';
import { PermissionKey } from '../models/role.model';

// The /superadmin shell now serves two kinds of session: the true owner
// (AdminAuthService — a real Admin login) and a Supervisor/Manager who was
// delegated some management permissions (AuthService — an ordinary Employee
// login, same as a plain laborer uses). A true Admin always bypasses every
// permission check below (mirrors requirePermission.js on the backend,
// which does the exact same thing) — a delegated employee only gets through
// if their Role actually grants the specific permission being checked.

// Also used by superadmin-login.component.ts to decide, right after an
// Employee login there, whether this account has anything to offload at all.
export const MANAGEABLE_PERMISSIONS: PermissionKey[] = [
  'employees', 'tasks', 'approvalsReimbursements', 'approvalsLeave',
  'approvalsRegularization', 'approvalsAdvance', 'salary',
];

function hasAnyManageablePermission(auth: AuthService): boolean {
  const permissions = auth.user()?.role?.permissions;
  return !!permissions && MANAGEABLE_PERMISSIONS.some(k => !!permissions[k]);
}

// Gates the /superadmin shell itself — just "is there a valid session of
// either kind, with *something* to manage." Each child route below still
// gates on the *specific* permission it needs.
export const superadminShellGuard: CanActivateFn = () => {
  const adminAuth = inject(AdminAuthService);
  const auth = inject(AuthService);
  const router = inject(Router);
  if (adminAuth.isAuthenticated()) return true;
  if (auth.isAuthenticated() && hasAnyManageablePermission(auth)) return true;
  return router.createUrlTree(['/superadmin']);
};

// A Supervisor/Manager lacking this one permission still has a normal
// employee session — send them to their own dashboard rather than a dead
// end (same fallback the old /team/* permission guards used).
export const superadminAreaGuard = (key: PermissionKey): CanActivateFn => () => {
  const adminAuth = inject(AdminAuthService);
  const auth = inject(AuthService);
  const router = inject(Router);
  if (adminAuth.isAuthenticated()) return true;
  if (auth.user()?.role?.permissions?.[key]) return true;
  return router.createUrlTree(['/dashboard']);
};

// For the Approvals page's several sub-permissions — accessible as long as
// at least one is granted; the component itself decides which tabs to show.
export const anySuperadminAreaGuard = (keys: PermissionKey[]): CanActivateFn => () => {
  const adminAuth = inject(AdminAuthService);
  const auth = inject(AuthService);
  const router = inject(Router);
  if (adminAuth.isAuthenticated()) return true;
  const permissions = auth.user()?.role?.permissions;
  if (permissions && keys.some(k => permissions[k])) return true;
  return router.createUrlTree(['/dashboard']);
};
