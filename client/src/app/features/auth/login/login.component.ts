import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { isValidEmail } from '../../../core/utils/validators';

// Just a cosmetic tab key for this login page's (mostly hidden) multi-portal
// UI — unrelated to the employee's actual assigned RBAC role (see
// core/models/role.model.ts). AuthService.login() ignores this entirely.
type LoginTabKind = 'customer' | 'vendor' | 'employee' | 'director' | 'field_worker';

interface RoleTab {
  role: LoginTabKind;
  label: string;
  icon: string;
  tagline: string;
  emailPlaceholder: string;
  authLabel: string;
  footerNote: string;
  loginMethods: string[];
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  readonly roleTabs: RoleTab[] = [
    {
      role: 'customer',
      label: 'Customer',
      icon: '☀️',
      tagline: 'Self-Service Dashboard',
      emailPlaceholder: 'your@email.com',
      authLabel: 'Login via Email / OTP',
      footerNote: 'New Customer? Create Account / Register',
      loginMethods: ['email', 'social'],
    },
    {
      role: 'vendor',
      label: 'Vendor',
      icon: '🔧',
      tagline: 'Partner Portal',
      emailPlaceholder: 'example@email.com',
      authLabel: 'Login via Email/Password',
      footerNote: 'Partner Account Creation restricted. Contact SUNदेश Procurement.',
      loginMethods: ['email', 'otp'],
    },
    {
      role: 'employee',
      label: 'Employee',
      icon: '👷',
      tagline: 'Staff Portal',
      emailPlaceholder: 'your email address',
      authLabel: 'Employee Login',
      footerNote: 'Access restricted to SUNदेश employees.',
      loginMethods: ['email'],
    },
    {
      role: 'director',
      label: 'Director',
      icon: '🏛️',
      tagline: 'Executive Suite',
      emailPlaceholder: 'Corporate Executive Email',
      authLabel: 'Login via Email/Password',
      footerNote: 'Authorization required. High-security protocol active.',
      loginMethods: ['email', 'biometric'],
    },
  ];

  activeTabIndex = signal(2); // default to Employee
  loginMethod = signal<'email' | 'otp'>('email');
  email = signal('');
  password = signal('');
  rememberMe = signal(false);
  showPassword = signal(false);
  loading = signal(false);
  error = signal('');

  get activeTab(): RoleTab {
    return this.roleTabs[this.activeTabIndex()];
  }

  constructor(private auth: AuthService, private router: Router) {}

  setTab(index: number): void {
    this.activeTabIndex.set(index);
    this.error.set('');
  }

  async onSubmit(): Promise<void> {
    this.error.set('');
    if (!isValidEmail(this.email())) {
      this.error.set('Enter a valid email address.');
      return;
    }

    this.loading.set(true);
    try {
      await this.auth.login(this.activeTab.role, this.email(), this.password());
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Invalid credentials. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  demoLogin(role: LoginTabKind): void {
    const idx = this.roleTabs.findIndex(t => t.role === role);
    if (idx >= 0) this.activeTabIndex.set(idx);
    this.loading.set(true);
    this.auth.login(role, 'demo@sundesh.in', 'demo').then(() => {
      this.loading.set(false);
      if (role === 'field_worker') {
        this.router.navigate(['/tasks']);
      } else {
        this.router.navigate(['/dashboard']);
      }
    });
  }
}
