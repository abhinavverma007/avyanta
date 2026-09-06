import { Component, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { AuthService } from '../../core/services/auth.service';
import { PermissionKey } from '../../core/models/role.model';
import { ICONS } from '../icons';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  // Which permission gates this tab for a delegated Supervisor/Manager
  // session — irrelevant for a true Admin session, which always sees every
  // tab (see navItems below and superadmin-area.guard.ts, which enforces
  // the same rule server-route-side).
  permission: PermissionKey;
}

@Component({
  selector: 'app-superadmin-shell',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, RouterLink, RouterLinkActive],
  templateUrl: './superadmin-shell.component.html',
  styleUrl: './superadmin-shell.component.scss',
})
export class SuperadminShellComponent {
  // Roles & Audit Log live in the account dropdown (below) instead of here —
  // they're owner-account/settings-shaped actions, not day-to-day work, so
  // they don't compete for space in the main nav or the mobile tab bar.
  // They're also never shown to a delegated session at all (see the
  // template) — that stays strictly owner-only.
  readonly allNavItems: NavItem[] = [
    { path: '/superadmin/employees', label: 'Employees', icon: 'users', permission: 'employees' },
    { path: '/superadmin/tasks', label: 'Tasks', icon: 'tasks', permission: 'tasks' },
    { path: '/superadmin/approvals', label: 'Approvals', icon: 'approvals', permission: 'approvalsReimbursements' },
    { path: '/superadmin/salary', label: 'Salary', icon: 'wallet', permission: 'salary' },
  ];

  menuOpen = signal(false);

  // Used both by the backdrop's click handler (see the template) and by the
  // Roles/Audit Log links, so navigating there doesn't leave the dropdown
  // stuck open.
  closeMenu(): void {
    this.menuOpen.set(false);
    this.resetChangePasswordForm();
  }

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

  // This console now serves two kinds of session — the true owner
  // (AdminAuthService) or a Supervisor/Manager delegated some management
  // permissions (AuthService, an ordinary Employee session — same one the
  // plain employee shell uses). Which one is active decides what the nav
  // shows, what the account box displays, and where Change Password/Logout
  // actually go — see app.routes.ts for how API_SCOPE is set to match.
  readonly isTrueAdmin = computed(() => this.adminAuth.isAuthenticated());

  readonly identityName = computed(() =>
    this.isTrueAdmin() ? this.adminAuth.admin()?.name : this.auth.user()?.name,
  );
  // Email for the owner (there's only ever one); the delegated Role's name
  // (e.g. "Supervisor") for anyone else, so it's clear whose access this is.
  readonly identitySubtitle = computed(() =>
    this.isTrueAdmin() ? this.adminAuth.admin()?.email : this.auth.user()?.role?.name,
  );

  readonly navItems = computed(() => {
    if (this.isTrueAdmin()) return this.allNavItems;
    const permissions = this.auth.user()?.role?.permissions;
    return this.allNavItems.filter(n => {
      // The Approvals tab covers four sub-permissions — shown if any one of
      // them is granted; the page itself only renders the tabs actually
      // permitted (see anySuperadminAreaGuard).
      if (n.path === '/superadmin/approvals') {
        return !!permissions?.approvalsReimbursements || !!permissions?.approvalsLeave
          || !!permissions?.approvalsRegularization || !!permissions?.approvalsAdvance;
      }
      return !!permissions?.[n.permission];
    });
  });

  constructor(
    private adminAuth: AdminAuthService,
    private auth: AuthService,
    private sanitizer: DomSanitizer,
  ) {
    // Unlike the plain employee shell, this one scrolls the whole document
    // (no internal overflow container) — so locking the menu's background
    // means locking body scroll directly. Runs for every place menuOpen can
    // change (toggle, backdrop click, Roles/Audit Log links), not just one.
    effect(() => {
      document.body.style.overflow = this.menuOpen() ? 'hidden' : '';
    });
  }

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
      if (this.isTrueAdmin()) {
        await this.adminAuth.changePassword(this.currentPassword(), this.newPassword());
      } else {
        await this.auth.changePassword(this.currentPassword(), this.newPassword());
      }
      this.cpSuccess.set('Password changed successfully. Logging you out… Please re-login.');
      this.currentPassword.set('');
      this.newPassword.set('');
      this.confirmPassword.set('');
      setTimeout(() => this.logout(), 1800);
    } catch (err: any) {
      this.cpError.set(err?.error?.message ?? 'Could not change password. Please try again.');
      this.submitting.set(false);
    }
  }

  logout(): void {
    if (this.isTrueAdmin()) {
      this.adminAuth.logout();
    } else {
      this.auth.logout();
    }
  }

  // A hard navigation, not router.navigate() — guarantees a fully fresh app
  // bootstrap, same reasoning as shell.component.ts's switchToManagementView
  // (the other direction).
  switchToEmployeeView(): void {
    window.location.href = '/dashboard';
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  }

  getIconSvg(icon: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(ICONS[icon] ?? '');
  }
}
