import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AdminAuthService } from '../../../core/services/admin-auth.service';
import { isValidEmail } from '../../../core/utils/validators';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';

// The one unified entry point — for everyone. There's no separate portal to
// pick: the same form tries an Employee login (laborer, or a Supervisor/
// Manager delegated some management permissions) first, then falls back to
// the owner's Admin login. An Employee session always lands on the plain
// dashboard — a Supervisor/Manager switches into the management console
// themselves afterward, from a control in that dashboard's header (see
// shell.component.ts). The owner's Admin account goes straight there.
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  email = signal('');
  password = signal('');
  showPassword = signal(false);
  loading = signal(false);
  error = signal('');

  private readonly greetingHour = new Date().getHours();
  readonly greetingKey = () =>
    this.greetingHour < 12 ? 'login.greetingMorning'
      : this.greetingHour < 17 ? 'login.greetingAfternoon' : 'login.greetingEvening';

  constructor(private auth: AuthService, private adminAuth: AdminAuthService, private router: Router, readonly i18n: I18nService) {}

  async onSubmit(): Promise<void> {
    this.error.set('');
    if (!isValidEmail(this.email())) {
      this.error.set(this.i18n.t('login.err.invalidEmail'));
      return;
    }

    this.loading.set(true);
    try {
      await this.auth.login('employee', this.email(), this.password());
      this.adminAuth.clearLocalSession();
      this.router.navigate(['/dashboard']);
      return;
    } catch {
      // Not a valid account — fall through and try it as the owner's Admin
      // login instead of failing immediately.
    }

    try {
      await this.adminAuth.login(this.email(), this.password());
      this.auth.clearLocalSession();
      this.router.navigate(['/superadmin/employees']);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? this.i18n.t('login.err.invalidCredentials'));
    } finally {
      this.loading.set(false);
    }
  }
}
