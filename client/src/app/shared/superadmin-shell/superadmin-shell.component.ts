import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  templateUrl: './superadmin-shell.component.html',
  styleUrl: './superadmin-shell.component.scss',
})
export class SuperadminShellComponent {
  readonly navItems: NavItem[] = [
    { path: '/superadmin/employees', label: 'Employees', icon: 'users' },
    { path: '/superadmin/tasks', label: 'Tasks', icon: 'tasks' },
    { path: '/superadmin/reimbursements', label: 'Reimbursements', icon: 'receipt' },
    { path: '/superadmin/salary', label: 'Salary', icon: 'wallet' },
  ];

  menuOpen = signal(false);

  readonly admin = computed(() => this.auth.admin());

  constructor(readonly auth: AdminAuthService, private sanitizer: DomSanitizer) {}

  toggleMenu(): void {
    this.menuOpen.update(v => !v);
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
      receipt: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2h16v20l-3-2-2 2-2-2-2 2-2-2-2 2-3-2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/></svg>`,
      wallet: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>`,
      tasks: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    };
    return this.sanitizer.bypassSecurityTrustHtml(icons[icon] ?? '');
  }
}
