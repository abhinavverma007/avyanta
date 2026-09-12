import { Component, Input, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NotificationService } from '../../core/services/notification.service';
import { AppNotification } from '../../core/models/notification.model';
import { ICONS } from '../icons';

// Polled rather than pushed (no websocket/SSE anywhere in this app) — often
// enough that a new approval/payout/task shows up within a minute of the
// app being open, without adding a persistent connection just for a badge.
const POLL_INTERVAL_MS = 45000;

// Shared between the plain employee shell (dark header) and the superadmin
// shell (light header) — see shell.component.html / superadmin-shell.
// component.html for where this is dropped in, and `variant` for how it
// adapts to each.
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss',
  host: {
    '[class.dark]': "variant === 'dark'",
  },
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  @Input() variant: 'light' | 'dark' = 'light';

  panelOpen = signal(false);
  notifications = signal<AppNotification[]>([]);
  unreadCount = signal(0);

  private pollHandle?: ReturnType<typeof setInterval>;

  constructor(
    private notificationService: NotificationService,
    private router: Router,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.refresh();
    this.pollHandle = setInterval(() => this.refresh(), POLL_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.pollHandle) clearInterval(this.pollHandle);
  }

  private refresh(): void {
    this.notificationService
      .list()
      .then(res => {
        this.notifications.set(res.notifications);
        this.unreadCount.set(res.unreadCount);
      })
      // A failed poll just leaves the badge stale until the next one —
      // never worth surfacing an error over.
      .catch(() => {});
  }

  togglePanel(): void {
    this.panelOpen.update(v => !v);
    if (this.panelOpen()) this.refresh();
  }

  closePanel(): void {
    this.panelOpen.set(false);
  }

  openNotification(n: AppNotification): void {
    this.closePanel();
    if (!n.read) {
      this.notifications.update(list => list.map(x => (x.id === n.id ? { ...x, read: true } : x)));
      this.unreadCount.update(c => Math.max(0, c - 1));
      this.notificationService.markRead(n.id).catch(() => {});
    }
    if (n.link) {
      // navigateByUrl (not routerLink) — these links come from the backend
      // as one opaque string that can carry a query string (e.g.
      // '/superadmin/approvals?section=leave&employee=EMP01'), which
      // navigateByUrl parses correctly and a routerLink string binding
      // would not.
      this.router.navigateByUrl(n.link);
    }
  }

  markAllRead(): void {
    this.notifications.update(list => list.map(n => ({ ...n, read: true })));
    this.unreadCount.set(0);
    this.notificationService.markAllRead().catch(() => {});
  }

  timeAgo(dateStr: string): string {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  getIconSvg(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(ICONS['bell'] ?? '');
  }
}
