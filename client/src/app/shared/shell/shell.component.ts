import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../core/services/auth.service';
import { MANAGEABLE_PERMISSIONS } from '../../core/guards/superadmin-area.guard';
import { ICONS } from '../icons';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';

interface NavItem {
  path: string;
  labelKey: string;
  icon: string;
}

// The simple employee view — every employee sees exactly this, whether
// they're a plain laborer or a Supervisor/Manager who's also been delegated
// management permissions. Delegated access lives entirely under
// /superadmin instead (see app.routes.ts and superadmin-shell.component.ts)
// — this shell never shows "Team:" management screens.
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive, NotificationBellComponent, TPipe],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  // Profile lives in the account dropdown (see the template) instead of
  // here, as "My Profile" — same reasoning as Roles/Audit Log living in the
  // superadmin shell's dropdown rather than its main nav: an
  // account/settings-shaped destination, not day-to-day work, so it
  // shouldn't compete for space in the footer tab bar.
  readonly navItems: NavItem[] = [
    { path: '/dashboard', labelKey: 'nav.home', icon: 'home' },
    { path: '/attendance', labelKey: 'nav.attendance', icon: 'calendar' },
    { path: '/requests', labelKey: 'nav.requests', icon: 'receipt' },
    { path: '/tasks', labelKey: 'nav.tasks', icon: 'tasks' },
    { path: '/salary', labelKey: 'nav.salary', icon: 'wallet' },
  ];

  profileOpen = signal(false);

  readonly user = computed(() => this.auth.user());

  // A Supervisor/Manager (any Role with at least one management permission)
  // can switch into the management console from here — everyone still logs
  // in the same way at /login and lands here by default (see
  // login.component.ts); this is the only way in the other direction.
  readonly hasManagementAccess = computed(() => {
    const permissions = this.user()?.role?.permissions;
    return !!permissions && MANAGEABLE_PERMISSIONS.some(k => permissions[k]);
  });

  constructor(
    readonly auth: AuthService,
    readonly i18n: I18nService,
    private sanitizer: DomSanitizer,
    private router: Router,
  ) {
    // Close the profile menu on any navigation (e.g. tapping a bottom tab,
    // which sits above the menu backdrop).
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.profileOpen.set(false));
  }

  toggleLanguage(): void {
    this.i18n.toggle();
    this.profileOpen.set(false);
  }

  toggleProfile(): void {
    this.profileOpen.update(v => !v);
  }

  // A hard navigation, not router.navigate() — guarantees a fully fresh app
  // bootstrap (no root-singleton service or route-provider value can carry
  // over stale from this session), exactly matching what the user asked
  // for ("page will be refreshed to load manager/supervisor view").
  async switchToManagementView(): Promise<void> {
    // Re-sync the cached Role first — the cached permissions can be stale
    // (changed by the owner since login), which would make the guards and
    // the backend disagree and bounce the user straight back here.
    try { await this.auth.refreshUser(); } catch { /* fall through with cached copy */ }
    if (!this.hasManagementAccess()) return;
    window.location.href = '/superadmin';
  }

  logout(): void {
    this.auth.logout();
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  }

  getIconSvg(icon: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(ICONS[icon] ?? '');
  }
}
