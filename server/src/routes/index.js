const express = require('express');
const authRoutes = require('./auth.routes');
const attendanceRoutes = require('./attendance.routes');
const leaveRoutes = require('./leave.routes');
const reimbursementRoutes = require('./reimbursements.routes');
const tasksRoutes = require('./tasks.routes');
const adminAuthRoutes = require('./adminAuth.routes');
const adminEmployeesRoutes = require('./adminEmployees.routes');
const adminReimbursementsRoutes = require('./adminReimbursements.routes');
const adminSalaryRoutes = require('./adminSalary.routes');
const adminTasksRoutes = require('./adminTasks.routes');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));

// Employee-facing
router.use('/auth', authRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leave', leaveRoutes);
router.use('/reimbursements', reimbursementRoutes);
router.use('/tasks', tasksRoutes);

// Superadmin-facing
router.use('/admin/auth', adminAuthRoutes);
router.use('/admin/employees', adminEmployeesRoutes);
router.use('/admin/reimbursements', adminReimbursementsRoutes);
router.use('/admin/salary', adminSalaryRoutes);
router.use('/admin/tasks', adminTasksRoutes);

module.exports = router;
