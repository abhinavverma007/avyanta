import { Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminEmployeeService } from '../../../core/services/admin-employee.service';
import { AdminRoleService } from '../../../core/services/admin-role.service';
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

// Best-effort digit extraction for *displaying* an existing employee's
// stored phone number, which may predate the +91-prefixed format (blank, no
// country code, formatted with spaces/hyphens, etc.) — this is only for
// showing something reasonable in the field; what actually gets submitted
// if the owner never touches it is the untouched original (see
// submitForm()), not a reconstruction of this.
function extractPhoneDigits(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) return digits.slice(2, 12);
  return digits.slice(-10);
}

@Component({
  selector: 'app-superadmin-employee-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './superadmin-employee-form.component.html',
  styleUrl: './superadmin-employee-form.component.scss',
})
export class SuperadminEmployeeFormComponent implements OnInit {
  employeeId = signal<string | null>(null);
  readonly isEditMode = computed(() => this.employeeId() !== null);
  loadingEmployee = signal(false);
  loadError = signal('');

  editingEmail = signal(''); // display-only, existing employee's email in edit mode
  editingEmployeeId = signal(''); // display-only
  form = signal<EmployeeForm>({ ...EMPTY_FORM });
  // The exact raw value as loaded from the server (edit mode only) — sent
  // through unchanged on submit unless phoneTouched is true, so a legacy
  // number in some other format is never rejected just because the owner
  // saved an unrelated field. form().phone only ever holds the 10-digit
  // remainder (the +91 prefix is fixed UI, never part of the input value).
  private originalPhone = '';
  phoneTouched = signal(false);
  phoneError = signal(''); // shown immediately on blur, not just at final submit
  emailPreview = signal(''); // create mode: server-computed live preview of the auto-generated email
  emailPreviewLoading = signal(false);
  private emailPreviewDebounce?: ReturnType<typeof setTimeout>;
  showPassword = signal(false);
  saving = signal(false);
  formError = signal('');

  readonly isAdminScope = inject(API_SCOPE) === 'admin';
  roles = signal<Role[]>([]);

  @ViewChild('upiIdInput') upiIdInputRef?: ElementRef<HTMLInputElement>;

  constructor(
    private employeeService: AdminEmployeeService,
    private roleService: AdminRoleService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    if (this.isAdminScope) {
      this.roleService.list().then(roles => this.roles.set(roles));
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      // Create mode — a preselected role from the Roles page's "+ Add" link.
      const roleId = this.route.snapshot.queryParamMap.get('role');
      if (roleId) this.updateField('roleId', roleId);
      return;
    }

    this.employeeId.set(id);
    this.loadingEmployee.set(true);
    this.employeeService
      .get(id)
      .then(emp => {
        this.editingEmail.set(emp.email);
        this.editingEmployeeId.set(emp.employeeId);
        this.originalPhone = emp.phone ?? '';
        this.form.set({
          name: emp.name,
          password: '',
          roleId: emp.role?.id ?? '',
          designation: emp.designation,
          department: emp.department,
          phone: extractPhoneDigits(emp.phone ?? ''),
          joinDate: emp.joinDate,
          location: emp.location,
          aadhaarNumber: formatAadhaar(emp.aadhaarNumber ?? ''),
          upiId: emp.upiId ?? '',
          salaryMonthly: emp.salaryMonthly,
          paidLeavesPerMonth: emp.paidLeavesPerMonth,
        });

        // Deep-linked from the Salary page's "Add UPI ID" prompt.
        if (this.route.snapshot.queryParamMap.get('focus') === 'upi') {
          setTimeout(() => {
            const el = this.upiIdInputRef?.nativeElement;
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el?.focus();
          });
        }
      })
      .catch(() => this.loadError.set('Could not load this employee. They may have been removed.'))
      .finally(() => this.loadingEmployee.set(false));
  }

  goBack(): void {
    this.router.navigate(['/superadmin/employees']);
  }

  updateField<K extends keyof EmployeeForm>(key: K, value: EmployeeForm[K]): void {
    this.form.update(f => ({ ...f, [key]: value }));
  }

  onNameInput(value: string): void {
    this.updateField('name', value);
    if (this.isEditMode()) return;

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

  // Takes the Event (not just the value) and writes the stripped digits
  // straight back onto the DOM element — Angular's [value] binding only
  // re-renders when the *bound* value changes from what it last set, so if
  // typing a letter into an empty field still computes to '' (no change
  // from Angular's point of view), it never overwrites the native input's
  // own DOM value, leaving the typed letter visibly stuck on screen.
  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 10);
    input.value = digits;
    this.phoneTouched.set(true);
    this.phoneError.set('');
    this.updateField('phone', digits);
  }

  onPhoneBlur(): void {
    const len = this.form().phone.length;
    this.phoneError.set(len > 0 && len < 10 ? 'Phone number must be exactly 10 digits.' : '');
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

    if (!this.isEditMode()) {
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

    // Untouched in edit mode — pass the original stored value straight
    // through, whatever format it happens to be in, rather than force a
    // pre-existing employee's phone into this format just because some
    // other field on the same form was edited.
    let phoneToSend: string;
    if (this.isEditMode() && !this.phoneTouched()) {
      phoneToSend = this.originalPhone;
    } else {
      if (f.phone && f.phone.length !== 10) {
        this.phoneError.set('Phone number must be exactly 10 digits.');
        this.formError.set('Phone number must be exactly 10 digits.');
        return;
      }
      phoneToSend = f.phone ? `+91${f.phone}` : '';
    }

    this.saving.set(true);
    try {
      if (this.isEditMode()) {
        const id = this.employeeId()!;
        await this.employeeService.update(id, {
          name: f.name,
          role: this.isAdminScope ? (f.roleId || undefined) : undefined,
          designation: f.designation,
          department: f.department,
          phone: phoneToSend,
          location: f.location,
          aadhaarNumber: aadhaarDigits,
          upiId: f.upiId,
          salaryMonthly: f.salaryMonthly ?? 0,
          paidLeavesPerMonth: f.paidLeavesPerMonth ?? 0,
        });
        this.router.navigate(['/superadmin/employees']);
      } else {
        const res = await this.employeeService.create({
          name: f.name,
          password: f.password || undefined,
          role: this.isAdminScope ? (f.roleId || undefined) : undefined,
          designation: f.designation,
          department: f.department,
          phone: phoneToSend,
          joinDate: f.joinDate,
          location: f.location,
          aadhaarNumber: aadhaarDigits || undefined,
          upiId: f.upiId || undefined,
          salaryMonthly: f.salaryMonthly ?? 0,
          paidLeavesPerMonth: f.paidLeavesPerMonth ?? 0,
        });
        // Passed via router state (not a service/query param) since it's a
        // one-off, sensitive value that should never end up in the URL or
        // linger anywhere — the list page reads history.state once on load.
        this.router.navigate(['/superadmin/employees'], {
          state: { credential: { name: res.employee.name, email: res.employee.email, password: res.generatedPassword } },
        });
      }
    } catch (err: any) {
      this.formError.set(err?.error?.message ?? 'Something went wrong. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }
}
