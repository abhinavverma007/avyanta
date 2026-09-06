const express = require('express');
const authRoutes = require('./auth.routes');
const attendanceRoutes = require('./attendance.routes');
const leaveRoutes = require('./leave.routes');
const reimbursementRoutes = require('./reimbursements.routes');
const tasksRoutes = require('./tasks.routes');
const regularizationRoutes = require('./attendanceRegularization.routes');
const salaryAdvanceRoutes = require('./salaryAdvance.routes');
const adminAuthRoutes = require('./adminAuth.routes');
const adminEmployeesRoutes = require('./adminEmployees.routes');
const adminReimbursementsRoutes = require('./adminReimbursements.routes');
const adminLeaveRoutes = require('./adminLeave.routes');
const adminSalaryRoutes = require('./adminSalary.routes');
const adminTasksRoutes = require('./adminTasks.routes');
const adminAttendanceRoutes = require('./adminAttendance.routes');
const adminRegularizationRoutes = require('./adminAttendanceRegularization.routes');
const adminSalaryAdvanceRoutes = require('./adminSalaryAdvance.routes');
const adminRoleRoutes = require('./adminRole.routes');
const adminAuditLogRoutes = require('./adminAuditLog.routes');
const bootstrapRoutes = require('./bootstrap.routes');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));

// TEMPORARY — no auth, one-time post-deploy use only. See
// bootstrap.controller.js. Remove this line (and the route/controller
// files) once production has been migrated.
router.use('/bootstrap', bootstrapRoutes);

// Employee-facing
router.use('/auth', authRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leave', leaveRoutes);
router.use('/reimbursements', reimbursementRoutes);
router.use('/tasks', tasksRoutes);
router.use('/regularizations', regularizationRoutes);
router.use('/advances', salaryAdvanceRoutes);

// Superadmin-only — never mounted under /team/*, no permission can grant
// these (role management and the audit trail of what was done "on the
// owner's behalf" must stay owner-only, see requirePermission.js).
router.use('/admin/auth', adminAuthRoutes);
router.use('/admin/roles', adminRoleRoutes);
router.use('/admin/audit-logs', adminAuditLogRoutes);

// Dual-mounted — each of these routers is internally gated by
// requirePermission(key) (or, for adminEmployeesRoutes, a per-route mix of
// requirePermission and strict adminAuth), so mounting the *same* router
// instance at both prefixes is what lets a permission-delegated employee
// reach the identical controllers a true admin uses, without duplicating
// any route-table or business logic. /admin/* is what the superadmin UI
// calls (sends the admin token); /team/* is what a Supervisor/Manager's
// employee-shell nav items call (sends the employee token) — see the
// frontend's API_SCOPE injection token and auth interceptor.
// Deliberately symmetric (/admin/x <-> /team/x, same resource name) so the
// frontend can swap just the scope prefix with no other path differences.
router.use('/admin/employees', adminEmployeesRoutes);
router.use('/team/employees', adminEmployeesRoutes);
router.use('/admin/tasks', adminTasksRoutes);
router.use('/team/tasks', adminTasksRoutes);
router.use('/admin/reimbursements', adminReimbursementsRoutes);
router.use('/team/reimbursements', adminReimbursementsRoutes);
router.use('/admin/leaves', adminLeaveRoutes);
router.use('/team/leaves', adminLeaveRoutes);
router.use('/admin/regularizations', adminRegularizationRoutes);
router.use('/team/regularizations', adminRegularizationRoutes);
router.use('/admin/advances', adminSalaryAdvanceRoutes);
router.use('/team/advances', adminSalaryAdvanceRoutes);
router.use('/admin/salary', adminSalaryRoutes);
router.use('/team/salary', adminSalaryRoutes);
router.use('/admin/attendance', adminAttendanceRoutes);
router.use('/team/attendance', adminAttendanceRoutes);

module.exports = router;
