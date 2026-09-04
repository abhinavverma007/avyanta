import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AdminAuthService } from '../../core/services/admin-auth.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-superadmin-shell',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, RouterLink, RouterLinkActive],
  templateUrl: './superadmin-shell.component.html',
  styleUrl: './superadmin-shell.component.scss',
})
export class SuperadminShellComponent {
  readonly navItems: NavItem[] = [
    { path: '/superadmin/employees', label: 'Employees', icon: 'users' },
    { path: '/superadmin/tasks', label: 'Tasks', icon: 'tasks' },
    { path: '/superadmin/approvals', label: 'Approvals', icon: 'approvals' },
    { path: '/superadmin/salary', label: 'Salary', icon: 'wallet' },
  ];

  menuOpen = signal(false);

  showChangePassword = signal(false);
  currentPassword = signal('');
  newPassword = signal('');
  confirmPassword = signal('');
  showCurrentPassword = signal(false);
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);
  submitting = signal(false);
  cpError = signal('');
  cpSuccess = signal('');

  readonly admin = computed(() => this.auth.admin());

  constructor(readonly auth: AdminAuthService, private sanitizer: DomSanitizer) {}

  toggleMenu(): void {
    this.menuOpen.update(v => !v);
    if (!this.menuOpen()) this.resetChangePasswordForm();
  }

  toggleChangePassword(): void {
    this.showChangePassword.update(v => !v);
    this.resetChangePasswordForm();
  }

  private resetChangePasswordForm(): void {
    this.cpError.set('');
    this.cpSuccess.set('');
    this.currentPassword.set('');
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.showCurrentPassword.set(false);
    this.showNewPassword.set(false);
    this.showConfirmPassword.set(false);
  }

  async submitChangePassword(): Promise<void> {
    this.cpError.set('');
    this.cpSuccess.set('');

    if (!this.currentPassword() || !this.newPassword() || !this.confirmPassword()) {
      this.cpError.set('All fields are required.');
      return;
    }
    if (this.newPassword().length < 6) {
      this.cpError.set('New password must be at least 6 characters.');
      return;
    }
    if (this.newPassword() !== this.confirmPassword()) {
      this.cpError.set('New password and confirmation do not match.');
      return;
    }

    this.submitting.set(true);
    try {
      await this.auth.changePassword(this.currentPassword(), this.newPassword());
      this.cpSuccess.set('Password changed successfully. Logging you out… Please re-login.');
      this.currentPassword.set('');
      this.newPassword.set('');
      this.confirmPassword.set('');
      setTimeout(() => this.auth.logout(), 1800);
    } catch (err: any) {
      this.cpError.set(err?.error?.message ?? 'Could not change password. Please try again.');
      this.submitting.set(false);
    }
  }

  logout(): void {
    this.auth.logout();
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  }

  getIconSvg(icon: string): SafeHtml {
    const icons: Record<string, string> = {
      users: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      approvals: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 14l2 2 4-4"/></svg>`,
      wallet: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>`,
      tasks: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    };
    return this.sanitizer.bypassSecurityTrustHtml(icons[icon] ?? '');
  }
}
