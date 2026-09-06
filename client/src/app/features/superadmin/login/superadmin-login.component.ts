import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminAuthService } from '../../../core/services/admin-auth.service';
import { AuthService } from '../../../core/services/auth.service';
import { MANAGEABLE_PERMISSIONS } from '../../../core/guards/superadmin-area.guard';
import { isValidEmail } from '../../../core/utils/validators';

// This console now serves two kinds of session: the true owner (a real
// Admin account) and a Supervisor/Manager who's been delegated some
// management permissions — same Employee credentials they'd also use at
// the regular /login page, offloading the owner's work right here instead
// of needing a separate login page of their own.
@Component({
  selector: 'app-superadmin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './superadmin-login.component.html',
  styleUrl: './superadmin-login.component.scss',
})
export class SuperadminLoginComponent implements OnInit {
  email = signal('');
  password = signal('');
  showPassword = signal(false);
  loading = signal(false);
  error = signal('');

  constructor(
    private adminAuth: AdminAuthService,
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    if (this.adminAuth.isAuthenticated()) {
      this.router.navigate(['/superadmin/employees']);
      return;
    }
    const permissions = this.auth.user()?.role?.permissions;
    if (permissions && MANAGEABLE_PERMISSIONS.some(k => permissions[k])) {
      this.router.navigate(['/superadmin/employees']);
    }
  }

  // Try the owner login first (the common case for this page); only fall
  // back to an employee login if that fails, since Admin and Employee
  // credentials live in entirely separate collections with no overlap.
  async onSubmit(): Promise<void> {
    this.error.set('');
    if (!isValidEmail(this.email())) {
      this.error.set('Enter a valid email address.');
      return;
    }

    this.loading.set(true);
    try {
      await this.adminAuth.login(this.email(), this.password());
      // A leftover Employee session from testing wouldn't actually break
      // API_SCOPE here (a real Admin session always wins there), but
      // leaving it around is still confusing — clear it so this is
      // unambiguously the owner's session.
      this.auth.clearLocalSession();
      this.router.navigate(['/superadmin/employees']);
      return;
    } catch {
      // Not an Admin account — fall through and try it as a delegated
      // Employee login instead of failing immediately.
    }

    try {
      await this.auth.login('employee', this.email(), this.password());
      const permissions = this.auth.user()?.role?.permissions;
      const hasManagementAccess = !!permissions && MANAGEABLE_PERMISSIONS.some(k => permissions[k]);
      if (!hasManagementAccess) {
        this.auth.clearLocalSession();
        this.error.set("This account doesn't have any management permissions. Use the employee login instead.");
        return;
      }
      // A leftover Admin session from earlier testing would otherwise
      // silently outrank this one (API_SCOPE picks 'admin' whenever any
      // Admin session exists) — clear it so this Employee session is
      // unambiguously the one in charge here.
      this.adminAuth.clearLocalSession();
      this.router.navigate(['/superadmin/employees']);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Invalid credentials. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
