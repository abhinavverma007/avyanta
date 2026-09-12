import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminAuthService } from './admin-auth.service';
import { NotificationList } from '../models/notification.model';

// A single service usable from either shell (plain employee, or the shared
// /superadmin shell for both the true owner and a delegated Supervisor/
// Manager) — it just checks which auth service actually has a live session,
// same check the shells themselves already do (see shell.component.ts /
// superadmin-shell.component.ts's isTrueAdmin). A true Admin session reads
// /admin/notifications; anyone else (plain employee, or a delegated
// manager whose own reviewer notifications live under their employee id —
// see notify.js) reads /notifications.
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly adminAuth = inject(AdminAuthService);

  private get base(): string {
    return this.adminAuth.isAuthenticated()
      ? `${environment.apiUrl}/admin/notifications`
      : `${environment.apiUrl}/notifications`;
  }

  constructor(private http: HttpClient) {}

  list(): Promise<NotificationList> {
    return firstValueFrom(this.http.get<NotificationList>(this.base));
  }

  markRead(id: string): Promise<void> {
    return firstValueFrom(this.http.patch(`${this.base}/${id}/read`, {})).then(() => undefined);
  }

  markAllRead(): Promise<void> {
    return firstValueFrom(this.http.patch(`${this.base}/read-all`, {})).then(() => undefined);
  }
}
