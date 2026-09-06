import { Component, OnInit, ViewChild, ElementRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { AdminEmployeeService } from '../../../core/services/admin-employee.service';
import { AdminRoleService } from '../../../core/services/admin-role.service';
import { AdminEmployee } from '../../../core/models/admin.model';
import { Role } from '../../../core/models/role.model';
import { generatePassword } from '../../../core/utils/generate-password';
import { API_SCOPE } from '../../../core/tokens/api-scope';

interface EmployeeForm {
  name: string;
  password: string;
  roleId: string; // admin-scope only — ignored/hidden in team scope
  designation: string;
  department: string;
  phone: string;
  joinDate: string;
  location: string;
  aadhaarNumber: string; // formatted with hyphens for display, e.g. 1234-5678-9012-3456
  upiId: string;
  salaryMonthly: number | null;
  paidLeavesPerMonth: number | null;
}

const EMPTY_FORM: EmployeeForm = {
  name: '', password: '', roleId: '', designation: '', department: '',
  phone: '', joinDate: '', location: '', aadhaarNumber: '', upiId: '', salaryMonthly: null, paidLeavesPerMonth: null,
};

// Groups digits into 4-4-4 with hyphens as the superadmin types, capped at
// 12 digits (real Aadhaar numbers are 12 digits).
function formatAadhaar(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 12);
  return digits.match(/.{1,4}/g)?.join('-') ?? digits;
}

// Card view (mobile) only shows Name + Status until tapped (see the
// template), so 10 fit per page without feeling cramped — higher than this
// app's usual page size of 3. The desktop table shares this same
// server-paginated list and stays comfortably readable at 10 rows too.
const PAGE_SIZE = 10;

@Component({
  selector: 'app-superadmin-employees',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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

  showForm = signal(false);
  formMode = signal<'create' | 'edit'>('create');
  editingId = signal<string | null>(null);
  editingEmail = signal(''); // display-only, existing employee's email in edit mode
  editingEmployeeId = signal(''); // display-only
  form = signal<EmployeeForm>({ ...EMPTY_FORM });
  emailPreview = signal(''); // create mode: server-computed live preview of the auto-generated email
  emailPreviewLoading = signal(false);
  private emailPreviewDebounce?: ReturnType<typeof setTimeout>;
  showPassword = signal(false);
  saving = signal(false);
  formError = signal('');

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
  // not showing controls
  // that would just 403 anyway).
  readonly isAdminScope = inject(API_SCOPE) === 'admin';

  roles = signal<Role[]>([]);

  @ViewChild('upiIdInput') upiIdInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('formPanel') formPanelRef?: ElementRef<HTMLDivElement>;

  constructor(
    private employeeService: AdminEmployeeService,
    private roleService: AdminRoleService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.load();
    this.handleEditDeepLink();
    this.handleAddRoleDeepLink();
    if (this.isAdminScope) {
      this.roleService.list().then(roles => this.roles.set(roles));
    }
  }

  // Supports being deep-linked from the Roles page's "+ Add <role>" button
  // with ?addRole=<roleId> — opens the create form with that role already
  // selected, so the owner only has to fill in the rest of the details.
  private handleAddRoleDeepLink(): void {
    const roleId = this.route.snapshot.queryParamMap.get('addRole');
    if (!roleId) return;

    this.router.navigate([], { queryParams: {}, replaceUrl: true });
    this.openCreateForm();
    this.updateField('roleId', roleId);
  }

  // Supports being deep-linked from elsewhere (e.g. the Salary page's "Add
  // UPI ID" prompt) with ?edit=<employeeId> — opens that employee's edit
  // form directly and focuses the UPI ID field, regardless of whether
  // they're on the currently-loaded page of the (paginated) list.
  private handleEditDeepLink(): void {
    const id = this.route.snapshot.queryParamMap.get('edit');
    if (!id) return;

    this.router.navigate([], { queryParams: {}, replaceUrl: true });
    this.employeeService.get(id).then(emp => {
      this.openEditForm(emp);
      setTimeout(() => {
        const el = this.upiIdInputRef?.nativeElement;
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el?.focus();
      });
    });
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
    this.formMode.set('create');
    this.editingId.set(null);
    const defaultRole = this.roles().find(r => r.isSystem);
    this.form.set({ ...EMPTY_FORM, roleId: defaultRole?.id ?? '' });
    this.emailPreview.set('');
    this.formError.set('');
    this.showForm.set(true);
    this.scrollToFormPanel();
  }

  openEditForm(emp: AdminEmployee): void {
    this.formMode.set('edit');
    this.editingId.set(emp.id);
    this.editingEmail.set(emp.email);
    this.editingEmployeeId.set(emp.employeeId);
    this.form.set({
      name: emp.name,
      password: '',
      roleId: emp.role?.id ?? '',
      designation: emp.designation,
      department: emp.department,
      phone: emp.phone,
      joinDate: emp.joinDate,
      location: emp.location,
      aadhaarNumber: formatAadhaar(emp.aadhaarNumber ?? ''),
      upiId: emp.upiId ?? '',
      salaryMonthly: emp.salaryMonthly,
      paidLeavesPerMonth: emp.paidLeavesPerMonth,
    });
    this.formError.set('');
    this.showForm.set(true);
    this.scrollToFormPanel();
  }

  // The form panel is an @if block, so it doesn't exist in the DOM until the
  // next change detection cycle runs — the setTimeout defers to right after
  // that, once `formPanelRef` is actually populated.
  private scrollToFormPanel(): void {
    setTimeout(() => {
      this.formPanelRef?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  updateField<K extends keyof EmployeeForm>(key: K, value: EmployeeForm[K]): void {
    this.form.update(f => ({ ...f, [key]: value }));
  }

  onNameInput(value: string): void {
    this.updateField('name', value);
    if (this.formMode() !== 'create') return;

    clearTimeout(this.emailPreviewDebounce);
    if (!value.trim()) {
      this.emailPreview.set('');
      return;
    }
    this.emailPreviewLoading.set(true);
    this.emailPreviewDebounce = setTimeout(() => {
      this.employeeService.previewEmail(value.trim()).then(email => {
        this.emailPreview.set(email);
        this.emailPreviewLoading.set(false);
      });
    }, 400);
  }

  // Reformatting on every keystroke inserts/removes hyphens, which shifts
  // where the caret should land — without correcting it, the browser just
  // snaps the caret to the end after every input, making it impossible to
  // edit a digit in the middle of the number.
  onAadhaarInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const rawValue = input.value;
    const caret = input.selectionStart ?? rawValue.length;
    const digitsBeforeCaret = rawValue.slice(0, caret).replace(/\D/g, '').length;

    const formatted = formatAadhaar(rawValue);
    this.updateField('aadhaarNumber', formatted);

    let newCaret = 0;
    let digitsSeen = 0;
    while (newCaret < formatted.length && digitsSeen < digitsBeforeCaret) {
      if (/\d/.test(formatted[newCaret])) digitsSeen++;
      newCaret++;
    }

    // Angular re-renders the bound `[value]` asynchronously, so the DOM
    // still holds the pre-format string during this handler — wait a tick
    // before moving the caret, otherwise it gets clamped against that stale
    // value instead of the reformatted one.
    setTimeout(() => input.setSelectionRange(newCaret, newCaret));
  }

  onSalaryInput(value: string): void {
    const digits = value.replace(/\D/g, '');
    this.updateField('salaryMonthly', digits ? Number(digits) : null);
  }

  formatMoney(value: number | null): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '';
    return value.toLocaleString('en-IN');
  }

  fillGeneratedPassword(): void {
    this.updateField('password', generatePassword());
  }

  async submitForm(): Promise<void> {
    const f = this.form();
    this.formError.set('');

    if (this.formMode() === 'create') {
      if (!f.name || !f.joinDate) {
        this.formError.set('Name and join date are required.');
        return;
      }
    }

    const aadhaarDigits = f.aadhaarNumber.replace(/-/g, '');
    if (aadhaarDigits && aadhaarDigits.length !== 12) {
      this.formError.set('Aadhaar number must be 12 digits.');
      return;
    }

    this.saving.set(true);
    try {
      if (this.formMode() === 'create') {
        const res = await this.employeeService.create({
          name: f.name,
          password: f.password || undefined,
          role: this.isAdminScope ? (f.roleId || undefined) : undefined,
          designation: f.designation,
          department: f.department,
          phone: f.phone,
          joinDate: f.joinDate,
          location: f.location,
          aadhaarNumber: aadhaarDigits || undefined,
          upiId: f.upiId || undefined,
          salaryMonthly: f.salaryMonthly ?? 0,
          paidLeavesPerMonth: f.paidLeavesPerMonth ?? 0,
        });
        this.credentialBanner.set({ name: res.employee.name, email: res.employee.email, password: res.generatedPassword });
      } else {
        const id = this.editingId()!;
        await this.employeeService.update(id, {
          name: f.name,
          role: this.isAdminScope ? (f.roleId || undefined) : undefined,
          designation: f.designation,
          department: f.department,
          phone: f.phone,
          location: f.location,
          aadhaarNumber: aadhaarDigits,
          upiId: f.upiId,
          salaryMonthly: f.salaryMonthly ?? 0,
          paidLeavesPerMonth: f.paidLeavesPerMonth ?? 0,
        });
      }
      this.showForm.set(false);
      this.load();
    } catch (err: any) {
      this.formError.set(err?.error?.message ?? 'Something went wrong. Please try again.');
    } finally {
      this.saving.set(false);
    }
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
