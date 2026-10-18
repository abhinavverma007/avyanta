import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminClientService } from '../../../core/services/admin-client.service';
import { ClientRecord } from '../../../core/models/client.model';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';

// The owner's client database: add, edit and delete clients (a client name plus
// the vendor it's served through). The Assign Task form picks from this list.
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
    return this.clients().filter(c => c.name.toLowerCase().includes(q) || c.vendorName.toLowerCase().includes(q));
  });

  // The form doubles as add and edit: editingId set => it edits that client.
  editingId = signal<string | null>(null);
  name = signal('');
  vendorName = signal('');
  saving = signal(false);
  formError = signal('');

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

  startEdit(client: ClientRecord): void {
    this.editingId.set(client.id);
    this.name.set(client.name);
    this.vendorName.set(client.vendorName);
    this.formError.set('');
    this.confirmDeleteId.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.name.set('');
    this.vendorName.set('');
    this.formError.set('');
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    const name = this.name().trim();
    const vendorName = this.vendorName().trim();
    if (!name) { this.formError.set(this.i18n.t('saClients.errName')); return; }
    if (!vendorName) { this.formError.set(this.i18n.t('saClients.errVendor')); return; }

    this.saving.set(true);
    this.formError.set('');
    try {
      const id = this.editingId();
      if (id) await this.service.update(id, { name, vendorName });
      else await this.service.create({ name, vendorName });
      this.cancelEdit();
      this.load();
    } catch (err: any) {
      this.formError.set(err?.error?.message ?? this.i18n.t('saClients.saveError'));
    } finally {
      this.saving.set(false);
    }
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
      if (this.editingId() === client.id) this.cancelEdit();
      this.confirmDeleteId.set(null);
      this.load();
    } catch (err: any) {
      this.listError.set(err?.error?.message ?? this.i18n.t('saClients.deleteError'));
    } finally {
      this.deletingId.set(null);
    }
  }
}
