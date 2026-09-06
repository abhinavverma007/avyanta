import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AdminAuthService } from '../../../core/services/admin-auth.service';
import { isValidEmail } from '../../../core/utils/validators';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  email = signal('');
  password = signal('');
  showPassword = signal(false);
  loading = signal(false);
  error = signal('');

  readonly greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  constructor(private auth: AuthService, private adminAuth: AdminAuthService, private router: Router) {}

  async onSubmit(): Promise<void> {
    this.error.set('');
    if (!isValidEmail(this.email())) {
      this.error.set('Enter a valid email address.');
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
      this.error.set(err?.error?.message ?? 'Invalid credentials. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
