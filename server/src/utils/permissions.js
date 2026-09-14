// The fixed catalog of delegable permissions — one per superadmin feature
// area. Deliberately feature-level, not per-action CRUD: it matches how the
// UI is already organized (one nav item / one approvals-tab = one toggle).
// Role management itself, and the highest-risk Employee actions (create,
// reset password, activate/deactivate, role assignment), are never in this
// list — they always require a true Admin token, regardless of any role's
// settings (see requirePermission.js and adminEmployee.controller.js).
const PERMISSION_CATALOG = [
  { key: 'employees', label: 'Manage Employees', description: 'View and edit employee details (not create, reset password, activate/deactivate, or change roles — those stay owner-only).' },
  { key: 'tasks', label: 'Assign Work', description: 'Assign and remove work tasks for employees.' },
  { key: 'approvalsReimbursements', label: 'Approve Reimbursements', description: 'Review and approve/reject expense claims.' },
  { key: 'approvalsLeave', label: 'Approve Leave', description: 'Review and approve/reject leave requests.' },
  { key: 'approvalsRegularization', label: 'Approve Attendance Fixes', description: 'Review and approve/reject attendance correction requests.' },
  { key: 'approvalsAdvance', label: 'Approve Salary Advances', description: 'Review and approve/reject requests for a cash advance against next month\'s salary.' },
  { key: 'salary', label: 'View & Pay Salary', description: 'View payable salary and record payouts.' },
];

const PERMISSION_KEYS = PERMISSION_CATALOG.map((p) => p.key);

module.exports = { PERMISSION_CATALOG, PERMISSION_KEYS };
