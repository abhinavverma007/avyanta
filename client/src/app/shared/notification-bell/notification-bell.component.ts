import { Component, Input, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NotificationService } from '../../core/services/notification.service';
import { AppNotification } from '../../core/models/notification.model';
import { ICONS } from '../icons';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';

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
  imports: [CommonModule, TPipe],
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
    private i18n: I18nService,
  ) {
    // Same as the account menus: any navigation closes the open panel.
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.closePanel());
  }

  ngOnInit(): void {
    this.refresh();
    this.pollHandle = setInterval(() => this.refresh(), POLL_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.pollHandle) clearInterval(this.pollHandle);
    this.watchScroll(false);
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
    this.watchScroll(this.panelOpen());
    if (this.panelOpen()) this.refresh();
  }

  closePanel(): void {
    this.panelOpen.set(false);
    this.watchScroll(false);
  }

  // Scrolling the page behind the open panel closes it (the backdrop below also
  // closes it on a wheel / touch-drag over it). Captured on the document so it
  // catches any scrolling container, not just the window — but scrolling the
  // panel's own list must not close it.
  private scrolling = false;
  private readonly onPageScroll = (e: Event): void => {
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('.notif-panel')) return;
    this.closePanel();
  };

  private watchScroll(on: boolean): void {
    if (on === this.scrolling) return;
    this.scrolling = on;
    if (on) document.addEventListener('scroll', this.onPageScroll, true);
    else document.removeEventListener('scroll', this.onPageScroll, true);
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
    if (mins < 1) return this.i18n.t('common.justNow');
    if (mins < 60) return this.i18n.t('common.minsAgo', { n: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return this.i18n.t('common.hoursAgo', { n: hours });
    const days = Math.floor(hours / 24);
    return this.i18n.t('common.daysAgo', { n: days });
  }

  getIconSvg(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(ICONS['bell'] ?? '');
  }
}
