import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../core/services/auth.service';
import { MANAGEABLE_PERMISSIONS } from '../../core/guards/superadmin-area.guard';
import { ICONS } from '../icons';

interface NavItem {
  path: string;
  label: string;
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
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  readonly navItems: NavItem[] = [
    { path: '/dashboard', label: 'Home', icon: 'home' },
    { path: '/attendance', label: 'Attendance', icon: 'calendar' },
    { path: '/requests', label: 'Requests', icon: 'receipt' },
    { path: '/tasks', label: 'Tasks', icon: 'tasks' },
    { path: '/profile', label: 'Profile', icon: 'user' },
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

  constructor(readonly auth: AuthService, private sanitizer: DomSanitizer) {}

  toggleProfile(): void {
    this.profileOpen.update(v => !v);
  }

  // A hard navigation, not router.navigate() — guarantees a fully fresh app
  // bootstrap (no root-singleton service or route-provider value can carry
  // over stale from this session), exactly matching what the user asked
  // for ("page will be refreshed to load manager/supervisor view").
  switchToManagementView(): void {
    window.location.href = '/superadmin/employees';
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
