import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminAuditLogService } from '../../../core/services/admin-audit-log.service';
import { AuditLogEntry } from '../../../core/models/audit-log.model';

// Read-only, glance-and-scan rows — page size is deliberately larger than
// the ~3 used elsewhere in this app (Leave/Regularization history etc.),
// since these aren't action rows you engage with one at a time.
const PAGE_SIZE = 20;

@Component({
  selector: 'app-superadmin-audit-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './superadmin-audit-log.component.html',
  styleUrl: './superadmin-audit-log.component.scss',
})
export class SuperadminAuditLogComponent implements OnInit {
  entries = signal<AuditLogEntry[]>([]);
  loading = signal(true);

  page = signal(1);
  totalPages = signal(1);
  total = signal(0);

  // Client-side filter over the currently-loaded page only (a name search,
  // not the backend's actorId-exact filter) — deliberately lightweight
  // since this is meant for quickly scanning one page at a glance.
  actorFilter = signal('');

  constructor(private auditLogService: AdminAuditLogService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.auditLogService
      .list({ page: this.page(), limit: PAGE_SIZE })
      .then(res => {
        this.entries.set(res.entries);
        this.total.set(res.total);
        this.totalPages.set(res.totalPages);
        this.loading.set(false);
      });
  }

  onActorFilterInput(value: string): void {
    this.actorFilter.set(value);
  }

  prevPage(): void {
    if (this.page() <= 1) return;
    this.page.update(p => p - 1);
    this.load();
  }

  nextPage(): void {
    if (this.page() >= this.totalPages()) return;
    this.page.update(p => p + 1);
    this.load();
  }

  get filteredEntries(): AuditLogEntry[] {
    const q = this.actorFilter().trim().toLowerCase();
    if (!q) return this.entries();
    return this.entries().filter(e => e.actorName.toLowerCase().includes(q));
  }
}
