import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminEmployeeService } from '../../../core/services/admin-employee.service';
import { AdminLeaveService } from '../../../core/services/admin-leave.service';
import { AdminReimbursementService } from '../../../core/services/admin-reimbursement.service';
import { AdminSalaryAdvanceService } from '../../../core/services/admin-salary-advance.service';
import { AdminTaskService } from '../../../core/services/admin-task.service';
import { AuthService } from '../../../core/services/auth.service';
import { API_SCOPE } from '../../../core/tokens/api-scope';
import { AdminEmployee } from '../../../core/models/admin.model';
import { AdminLeave } from '../../../core/models/leave.model';
import { AdminReimbursement } from '../../../core/models/reimbursement.model';
import { AdminSalaryAdvance } from '../../../core/models/salary-advance.model';
import { AdminTask } from '../../../core/models/admin-task.model';

type ProfileTab = 'leave' | 'reimbursement' | 'advance' | 'tasks';

@Component({
  selector: 'app-superadmin-employee-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './superadmin-employee-profile.component.html',
  styleUrl: './superadmin-employee-profile.component.scss',
})
export class SuperadminEmployeeProfileComponent implements OnInit {
  employeeId = '';
  employee = signal<AdminEmployee | null>(null);
  loadingEmployee = signal(true);

  private readonly isAdminScope = inject(API_SCOPE) === 'admin';
  private readonly authService = inject(AuthService);

  // Reaching this page at all only requires "employees" permission (same as
  // Attendance History), but each tab shows data that belongs to a more
  // specific permission (leave/reimbursement/advance approvals, tasks) — a
  // Supervisor who can edit employee records shouldn't automatically also
  // see their reimbursement claims or salary advances unless their role
  // was actually granted that permission too. A true admin always sees all.
  private readonly permissions = this.authService.user()?.role?.permissions;
  private readonly canViewLeave = this.isAdminScope || !!this.permissions?.approvalsLeave;
  private readonly canViewReimbursement = this.isAdminScope || !!this.permissions?.approvalsReimbursements;
  private readonly canViewAdvance = this.isAdminScope || !!this.permissions?.approvalsAdvance;
  private readonly canViewTasks = this.isAdminScope || !!this.permissions?.tasks;

  readonly tabOptions: { value: ProfileTab; label: string }[] = [
    ...(this.canViewLeave ? [{ value: 'leave' as const, label: 'Leave' }] : []),
    ...(this.canViewReimbursement ? [{ value: 'reimbursement' as const, label: 'Reimbursement' }] : []),
    ...(this.canViewAdvance ? [{ value: 'advance' as const, label: 'Advance' }] : []),
    ...(this.canViewTasks ? [{ value: 'tasks' as const, label: 'Tasks' }] : []),
  ];

  tab = signal<ProfileTab | null>(null);
  loading = signal(false);

  leaves = signal<AdminLeave[]>([]);
  reimbursements = signal<AdminReimbursement[]>([]);
  advances = signal<AdminSalaryAdvance[]>([]);
  tasks = signal<AdminTask[]>([]);

  constructor(
    private route: ActivatedRoute,
    private employeeService: AdminEmployeeService,
    private leaveService: AdminLeaveService,
    private reimbursementService: AdminReimbursementService,
    private advanceService: AdminSalaryAdvanceService,
    private taskService: AdminTaskService,
  ) {}

  ngOnInit(): void {
    this.employeeId = this.route.snapshot.paramMap.get('id') ?? '';
    this.employeeService
      .get(this.employeeId)
      .then(emp => this.employee.set(emp))
      .finally(() => this.loadingEmployee.set(false));

    const firstTab = this.tabOptions[0]?.value;
    if (firstTab) this.setTab(firstTab);
  }

  setTab(tab: ProfileTab): void {
    if (this.tab() === tab) return;
    this.tab.set(tab);
    this.load();
  }

  load(): void {
    const tab = this.tab();
    if (!tab) return;
    this.loading.set(true);

    if (tab === 'leave') {
      this.leaveService.list(undefined, this.employeeId).then(rows => {
        this.leaves.set(rows);
        this.loading.set(false);
      });
    } else if (tab === 'reimbursement') {
      this.reimbursementService.list(undefined, this.employeeId).then(rows => {
        this.reimbursements.set(rows);
        this.loading.set(false);
      });
    } else if (tab === 'advance') {
      this.advanceService.list(undefined, this.employeeId).then(rows => {
        this.advances.set(rows);
        this.loading.set(false);
      });
    } else if (tab === 'tasks') {
      this.taskService.list({ employeeId: this.employeeId, limit: 100 }).then(res => {
        this.tasks.set(res.tasks);
        this.loading.set(false);
      });
    }
  }

  // Leave/Reimbursement/Advance share the same 3-state enum.
  approvalBadgeClass(status: string): string {
    if (status === 'approved') return 'badge-success';
    if (status === 'rejected') return 'badge-danger';
    return 'badge-warning';
  }

  taskBadgeClass(status: string): string {
    if (status === 'completed') return 'badge-success';
    if (status === 'in_progress') return 'badge-info';
    return 'badge-warning';
  }
}
