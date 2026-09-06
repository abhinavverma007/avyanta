// Mirrors server/src/utils/permissions.js — kept in sync manually, same as
// other small fixed catalogs already duplicated between client/server in
// this codebase (e.g. ReimbursementCategory).
export type PermissionKey =
  | 'employees'
  | 'tasks'
  | 'approvalsReimbursements'
  | 'approvalsLeave'
  | 'approvalsRegularization'
  | 'approvalsAdvance'
  | 'salary';

export const PERMISSION_CATALOG: { key: PermissionKey; label: string; description: string }[] = [
  { key: 'employees', label: 'Manage Employees', description: 'View and edit employee details (not create, reset password, activate/deactivate, or change roles — those stay owner-only).' },
  { key: 'tasks', label: 'Assign Work', description: 'Assign and remove work tasks for employees.' },
  { key: 'approvalsReimbursements', label: 'Approve Reimbursements', description: 'Review and approve/reject expense claims.' },
  { key: 'approvalsLeave', label: 'Approve Leave', description: 'Review and approve/reject leave requests.' },
  { key: 'approvalsRegularization', label: 'Approve Attendance Fixes', description: 'Review and approve/reject attendance correction requests.' },
  { key: 'approvalsAdvance', label: 'Approve Salary Advances', description: 'Review and approve/reject requests for a cash advance against next month\'s salary.' },
  { key: 'salary', label: 'View & Pay Salary', description: 'View payable salary and record payouts.' },
];

export type RolePermissions = Record<PermissionKey, boolean>;

export interface Role {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: RolePermissions;
  employeeCount: number;
  createdAt: string;
}

export interface CreateRolePayload {
  name: string;
  permissions?: Partial<RolePermissions>;
}

export interface UpdateRolePayload {
  name?: string;
  permissions?: Partial<RolePermissions>;
}
