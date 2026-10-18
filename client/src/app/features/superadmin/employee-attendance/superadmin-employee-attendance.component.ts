import { Component, HostListener, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminAttendanceService } from '../../../core/services/admin-attendance.service';
import { AdminLeaveService } from '../../../core/services/admin-leave.service';
import { AdminReimbursementService } from '../../../core/services/admin-reimbursement.service';
import { AdminSalaryAdvanceService } from '../../../core/services/admin-salary-advance.service';
import { AdminTaskService } from '../../../core/services/admin-task.service';
import { AuthService } from '../../../core/services/auth.service';
import { API_SCOPE } from '../../../core/tokens/api-scope';
import { AdminLeave } from '../../../core/models/leave.model';
import { AdminReimbursement } from '../../../core/models/reimbursement.model';
import { AdminSalaryAdvance } from '../../../core/models/salary-advance.model';
import { AdminTask } from '../../../core/models/admin-task.model';
import { AdminMonthlyAttendance, DayAttendance } from '../../../core/models/attendance.model';
import { TPipe } from '../../../core/i18n/t.pipe';
import { I18nService } from '../../../core/i18n/i18n.service';
import { formatWorkDuration } from '../../../core/utils/format-duration';
import { dayFill } from '../../../core/utils/day-fill';

type HistoryTab = 'leave' | 'reimbursement' | 'advance' | 'tasks';
type PageTab = 'attendance' | HistoryTab;

@Component({
  selector: 'app-superadmin-employee-attendance',
  standalone: true,
  imports: [CommonModule, SlicePipe, FormsModule, RouterLink, TPipe],
  templateUrl: './superadmin-employee-attendance.component.html',
  styleUrl: './superadmin-employee-attendance.component.scss',
})
export class SuperadminEmployeeAttendanceComponent implements OnInit {
  readonly DOW = ['saEmpAtt.dow.sun', 'saEmpAtt.dow.mon', 'saEmpAtt.dow.tue', 'saEmpAtt.dow.wed', 'saEmpAtt.dow.thu', 'saEmpAtt.dow.fri', 'saEmpAtt.dow.sat'];
  readonly i18n = inject(I18nService);
  readonly today = new Date();
  readonly formatWorkDuration = formatWorkDuration;
  readonly dayFill = dayFill;

  employeeId = '';
  viewYear = signal(new Date().getFullYear());
  viewMonth = signal(new Date().getMonth() + 1);
  selectedDay = signal<DayAttendance | null>(null);

  // Owner-only attendance override, shown inside the day popup. A delegated
  // Supervisor/Manager never gets the editor (and the server refuses them too).
  readonly canOverride = inject(API_SCOPE) === 'admin';
  editStatus = signal<'present' | 'absent' | 'leave'>('present');
  editIn = signal('09:30');
  editOut = signal('18:00');
  editPercent = signal<number | null>(100);
  editReason = signal('');
  saving = signal(false);
  editError = signal('');

  monthlyData = signal<AdminMonthlyAttendance | null>(null);
  loading = signal(true);

  // Attendance is the landing view; the employee's leave / reimbursement /
  // advance / task history sits beside it as extra tabs (this page replaced
  // the separate "View profile" page). Reaching the page only needs
  // "employees" permission, but each extra tab shows data that belongs to a
  // more specific permission — a delegated Supervisor/Manager only gets the
  // tabs their Role was actually granted. A true admin sees all of them.
  private readonly isAdminScope = inject(API_SCOPE) === 'admin';
  private readonly permissions = inject(AuthService).user()?.role?.permissions;

  readonly tabOptions: { value: PageTab; label: string }[] = [
    { value: 'attendance', label: 'saEmpProfile.tabAttendance' },
    ...(this.isAdminScope || this.permissions?.approvalsLeave ? [{ value: 'leave' as const, label: 'saEmpProfile.tabLeave' }] : []),
    ...(this.isAdminScope || this.permissions?.approvalsReimbursements ? [{ value: 'reimbursement' as const, label: 'saEmpProfile.tabReimb' }] : []),
    ...(this.isAdminScope || this.permissions?.approvalsAdvance ? [{ value: 'advance' as const, label: 'saEmpProfile.tabAdvance' }] : []),
    ...(this.isAdminScope || this.permissions?.tasks ? [{ value: 'tasks' as const, label: 'saEmpProfile.tabTasks' }] : []),
  ];

  tab = signal<PageTab>('attendance');
  historyLoading = signal(false);
  // One employee's history doesn't change while the owner bounces between
  // tabs — no need to hit the server again for a tab already fetched.
  private loadedTabs = new Set<HistoryTab>();

  leaves = signal<AdminLeave[]>([]);
  reimbursements = signal<AdminReimbursement[]>([]);
  advances = signal<AdminSalaryAdvance[]>([]);
  tasks = signal<AdminTask[]>([]);

  readonly calendarCells = computed(() => {
    const data = this.monthlyData();
    if (!data) return [];
    const firstDay = new Date(data.year, data.month - 1, 1).getDay();
    const cells: Array<DayAttendance | null> = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    cells.push(...data.days);
    return cells;
  });

  readonly monthLabel = computed(() => {
    const y = this.viewYear();
    const m = this.viewMonth();
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  });

  constructor(
    private route: ActivatedRoute,
    private attendanceService: AdminAttendanceService,
    private leaveService: AdminLeaveService,
    private reimbursementService: AdminReimbursementService,
    private advanceService: AdminSalaryAdvanceService,
    private taskService: AdminTaskService,
  ) {}

  ngOnInit(): void {
    this.employeeId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadMonth();
  }

  setTab(tab: PageTab): void {
    if (this.tab() === tab) return;
    this.tab.set(tab);
    if (tab !== 'attendance') this.loadHistory(tab);
  }

  private loadHistory(tab: HistoryTab): void {
    if (this.loadedTabs.has(tab)) return;
    this.historyLoading.set(true);
    const done = () => {
      this.loadedTabs.add(tab);
      this.historyLoading.set(false);
    };

    if (tab === 'leave') {
      this.leaveService.list(undefined, this.employeeId).then(rows => { this.leaves.set(rows); done(); });
    } else if (tab === 'reimbursement') {
      this.reimbursementService.list(undefined, this.employeeId).then(rows => { this.reimbursements.set(rows); done(); });
    } else if (tab === 'advance') {
      this.advanceService.list(undefined, this.employeeId).then(rows => { this.advances.set(rows); done(); });
    } else {
      this.taskService.list({ employeeId: this.employeeId, limit: 100 }).then(res => { this.tasks.set(res.tasks); done(); });
    }
  }

  loadMonth(): Promise<void> {
    this.loading.set(true);
    return this.attendanceService
      .getMonthly(this.employeeId, this.viewYear(), this.viewMonth())
      .then(data => {
        this.monthlyData.set(data);
        this.loading.set(false);
      });
  }

  prevMonth(): void {
    let m = this.viewMonth() - 1;
    let y = this.viewYear();
    if (m < 1) { m = 12; y--; }
    this.viewMonth.set(m);
    this.viewYear.set(y);
    this.selectedDay.set(null);
    this.loadMonth();
  }

  nextMonth(): void {
    const now = new Date();
    if (this.viewYear() >= now.getFullYear() && this.viewMonth() >= now.getMonth() + 1) return;
    let m = this.viewMonth() + 1;
    let y = this.viewYear();
    if (m > 12) { m = 1; y++; }
    this.viewMonth.set(m);
    this.viewYear.set(y);
    this.selectedDay.set(null);
    this.loadMonth();
  }

  canGoNext(): boolean {
    const now = new Date();
    return !(this.viewYear() >= now.getFullYear() && this.viewMonth() >= now.getMonth() + 1);
  }

  @HostListener('document:keydown.escape')
  closeDay(): void {
    this.selectedDay.set(null);
  }

  selectDay(day: DayAttendance | null): void {
    if (!day || day.status === 'future') return;
    this.selectedDay.set(day);
    this.resetEditor(day);
  }

  // A present day keeps its times; any other day starts with the usual hours.
  private resetEditor(day: DayAttendance): void {
    // The day's own status isn't offered again (except Present, whose times can be edited), so always start on Present.
    this.editStatus.set('present');
    this.editIn.set(day.status === 'present' && day.checkIn ? day.checkIn : '09:30');
    this.editOut.set(day.status === 'present' && day.checkOut ? day.checkOut : '18:00');
    this.editPercent.set(day.status === 'present' && day.percent ? day.percent : 100);
    this.editReason.set('');
    this.editError.set('');
  }

  // A full day's length, used to turn a percentage into a check-out time
  // (09:30 -> 18:00, the usual hours the editor starts with). 50% => 4h 15m.
  private readonly FULL_DAY_MINUTES = 510;

  // Check-out follows the percentage: first punch-in + that share of a full
  // day (capped at 23:59). Called whenever the percentage or check-in changes;
  // editing the check-out by hand afterwards is still allowed.
  private syncCheckOut(): void {
    const pct = this.editPercent();
    const [h, m] = this.editIn().split(':').map(Number);
    if (pct === null || pct < 1 || pct > 100 || Number.isNaN(h) || Number.isNaN(m)) return;
    const out = Math.min(23 * 60 + 59, h * 60 + m + Math.round((pct / 100) * this.FULL_DAY_MINUTES));
    this.editOut.set(`${String(Math.floor(out / 60)).padStart(2, '0')}:${String(out % 60).padStart(2, '0')}`);
  }

  setPercent(pct: number): void {
    this.editPercent.set(pct);
    this.syncCheckOut();
  }

  onPercentInput(value: string): void {
    const n = Number(value);
    this.editPercent.set(value.trim() === '' || !Number.isFinite(n) ? null : n);
    this.syncCheckOut();
  }

  onCheckInInput(value: string): void {
    this.editIn.set(value);
    this.syncCheckOut();
  }

  // Saving "absent" or "leave" on a day that already is that is a no-op.
  canSaveOverride(day: DayAttendance): boolean {
    if (this.saving()) return false;
    const target = this.editStatus();
    if (target === 'present') {
      const pct = this.editPercent();
      return !!this.editIn() && !!this.editOut() && pct !== null && pct >= 1 && pct <= 100;
    }
    return target !== day.status;
  }

  async saveOverride(day: DayAttendance): Promise<void> {
    if (!this.canSaveOverride(day)) return;
    this.saving.set(true);
    this.editError.set('');
    try {
      const status = this.editStatus();
      await this.attendanceService.overrideDay(this.employeeId, day.date, {
        status,
        checkIn: status === 'present' ? this.editIn() : undefined,
        checkOut: status === 'present' ? this.editOut() : undefined,
        percent: status === 'present' ? (this.editPercent() ?? 100) : undefined,
        reason: this.editReason().trim() || undefined,
      });
      // Saved — close the popup and refresh the calendar behind it.
      this.selectedDay.set(null);
      await this.loadMonth();
    } catch (err: any) {
      this.editError.set(err?.error?.message ?? this.i18n.t('saEmpAtt.overrideFailed'));
    } finally {
      this.saving.set(false);
    }
  }


  isToday(day: DayAttendance | null): boolean {
    if (!day) return false;
    const d = parseInt(day.date.split('-')[2], 10);
    return d === this.today.getDate()
      && this.viewMonth() === this.today.getMonth() + 1
      && this.viewYear() === this.today.getFullYear();
  }

  formatDayDisplay(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      present: 'saEmpAtt.present', absent: 'saEmpAtt.absent', leave: 'saEmpAtt.leave', pending: 'saEmpAtt.pending',
    };
    return map[status] ? this.i18n.t(map[status]) : (status === 'future' ? '—' : status);
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
