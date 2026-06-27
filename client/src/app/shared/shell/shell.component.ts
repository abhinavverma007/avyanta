import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles: string[];
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  readonly allNavItems: NavItem[] = [
    { path: '/dashboard',  label: 'Home',       icon: 'home',        roles: ['employee','director','customer','vendor'] },
    { path: '/attendance', label: 'Attendance',  icon: 'calendar',    roles: ['employee','director'] },
    { path: '/leave',      label: 'Leave',       icon: 'leaf',        roles: ['employee','director'] },
    { path: '/tasks',      label: 'Tasks',       icon: 'tasks',       roles: ['field_worker','employee'] },
    { path: '/profile',    label: 'Profile',     icon: 'user',        roles: ['employee','field_worker','director','customer','vendor'] },
  ];

  profileOpen = signal(false);

  readonly user = computed(() => this.auth.user());
  readonly navItems = computed(() => {
    const role = this.user()?.role ?? '';
    return this.allNavItems.filter(n => n.roles.includes(role));
  });

  constructor(readonly auth: AuthService, private sanitizer: DomSanitizer) {}

  toggleProfile(): void {
    this.profileOpen.update(v => !v);
  }

  logout(): void {
    this.auth.logout();
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  }

  getIconSvg(icon: string): SafeHtml {
    const icons: Record<string, string> = {
      home: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
      calendar: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      leaf: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8C8 10 5.9 16.17 3.82 19.11a1.006 1.006 0 0 0 1.41 1.41C9.54 18.29 15.5 16 21 16a1 1 0 0 0 1-1c0-5-2-9-5-7z"/></svg>`,
      tasks: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
      user: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    };
    return this.sanitizer.bypassSecurityTrustHtml(icons[icon] ?? '');
  }
}
