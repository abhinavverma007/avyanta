import { Component, ElementRef, HostListener, ViewChild, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../core/services/auth.service';
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

  @ViewChild('profileArea') profileAreaRef?: ElementRef<HTMLElement>;

  // The dropdown otherwise only ever closes via its own Sign Out button —
  // clicking anywhere else on the page left it stuck open.
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.profileOpen()) return;
    if (!this.profileAreaRef?.nativeElement.contains(event.target as Node)) {
      this.profileOpen.set(false);
    }
  }

  readonly user = computed(() => this.auth.user());

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
    return this.sanitizer.bypassSecurityTrustHtml(ICONS[icon] ?? '');
  }
}
