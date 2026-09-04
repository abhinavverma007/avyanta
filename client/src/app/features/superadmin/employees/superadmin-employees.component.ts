import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminEmployeeService } from '../../../core/services/admin-employee.service';
import { AdminEmployee } from '../../../core/models/admin.model';
import { generatePassword } from '../../../core/utils/generate-password';

interface EmployeeForm {
  name: string;
  password: string;
  designation: string;
  department: string;
  phone: string;
  joinDate: string;
  location: string;
  aadhaarNumber: string; // formatted with hyphens for display, e.g. 1234-5678-9012-3456
  salaryMonthly: number | null;
  paidLeavesPerMonth: number | null;
}

const EMPTY_FORM: EmployeeForm = {
  name: '', password: '', designation: '', department: '',
  phone: '', joinDate: '', location: '', aadhaarNumber: '', salaryMonthly: null, paidLeavesPerMonth: null,
};

// Groups digits into 4-4-4 with hyphens as the superadmin types, capped at
// 12 digits (real Aadhaar numbers are 12 digits).
function formatAadhaar(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 12);
  return digits.match(/.{1,4}/g)?.join('-') ?? digits;
}

const PAGE_SIZE = 20;

@Component({
  selector: 'app-superadmin-employees',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  constructor(private employeeService: AdminEmployeeService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.employeeService
      .list({ search: this.search(), page: this.page(), limit: PAGE_SIZE })
      .then(res => {
        this.employees.set(res.employees);
        this.total.set(res.total);
        this.totalPages.set(res.totalPages);
        this.loading.set(false);
      });
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
    this.form.set({ ...EMPTY_FORM });
    this.emailPreview.set('');
    this.formError.set('');
    this.showForm.set(true);
  }

  openEditForm(emp: AdminEmployee): void {
    this.formMode.set('edit');
    this.editingId.set(emp.id);
    this.editingEmail.set(emp.email);
    this.editingEmployeeId.set(emp.employeeId);
    this.form.set({
      name: emp.name,
      password: '',
      designation: emp.designation,
      department: emp.department,
      phone: emp.phone,
      joinDate: emp.joinDate,
      location: emp.location,
      aadhaarNumber: formatAadhaar(emp.aadhaarNumber ?? ''),
      salaryMonthly: emp.salaryMonthly,
      paidLeavesPerMonth: emp.paidLeavesPerMonth,
    });
    this.formError.set('');
    this.showForm.set(true);
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

  onAadhaarInput(value: string): void {
    this.updateField('aadhaarNumber', formatAadhaar(value));
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
          designation: f.designation,
          department: f.department,
          phone: f.phone,
          joinDate: f.joinDate,
          location: f.location,
          aadhaarNumber: aadhaarDigits || undefined,
          salaryMonthly: f.salaryMonthly ?? 0,
          paidLeavesPerMonth: f.paidLeavesPerMonth ?? 0,
        });
        this.credentialBanner.set({ name: res.employee.name, email: res.employee.email, password: res.generatedPassword });
      } else {
        const id = this.editingId()!;
        await this.employeeService.update(id, {
          name: f.name,
          designation: f.designation,
          department: f.department,
          phone: f.phone,
          location: f.location,
          aadhaarNumber: aadhaarDigits,
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

  async copyPassword(password: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(password);
    } catch {
      // clipboard access can be blocked; password is still visible on screen to copy manually
    }
  }
}
