import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminClientService } from '../../../core/services/admin-client.service';
import { ClientRecord } from '../../../core/models/client.model';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';

// The owner's client database: the list, with search, history and delete. Adding and
// editing a client happen on their own page (superadmin-client-form.component).
@Component({
  selector: 'app-superadmin-clients',
  standalone: true,
  imports: [CommonModule, RouterLink, TPipe],
  templateUrl: './superadmin-clients.component.html',
  styleUrl: './superadmin-clients.component.scss',
})
export class SuperadminClientsComponent implements OnInit {
  private readonly service = inject(AdminClientService);
  readonly i18n = inject(I18nService);

  clients = signal<ClientRecord[]>([]);
  loading = signal(true);
  loadError = signal('');
  search = signal('');

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.clients();
    // Searches the name, vendor and the contact details — never the Wi-Fi password.
    return this.clients().filter(c =>
      [c.clientCode, c.name, c.vendorName, c.mobileNumber, c.email, c.address].some(v => (v ?? '').toLowerCase().includes(q)),
    );
  });

  // Which clients' saved Wi-Fi password is currently shown in the list (hidden by default).
  revealedWifi = signal<ReadonlySet<string>>(new Set());

  // Inline two-step delete (no browser dialog).
  confirmDeleteId = signal<string | null>(null);
  deletingId = signal<string | null>(null);
  listError = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.service
      .list()
      .then(list => this.clients.set(list))
      .catch(() => this.loadError.set(this.i18n.t('saClients.loadError')))
      .finally(() => this.loading.set(false));
  }

  toggleWifi(id: string): void {
    this.revealedWifi.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  askDelete(id: string): void {
    this.confirmDeleteId.set(id);
    this.listError.set('');
  }

  async confirmDelete(client: ClientRecord): Promise<void> {
    this.deletingId.set(client.id);
    this.listError.set('');
    try {
      await this.service.remove(client.id);
      this.confirmDeleteId.set(null);
      this.load();
    } catch (err: any) {
      this.listError.set(err?.error?.message ?? this.i18n.t('saClients.deleteError'));
    } finally {
      this.deletingId.set(null);
    }
  }
}
