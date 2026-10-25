import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminClientService } from '../../../core/services/admin-client.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import { LocationPickerComponent, SiteLatLng } from '../../../shared/components/location-picker/location-picker.component';
import { geocodeAddress, parseLatLng } from '../../../shared/utils/geocode';

// Add a client (/superadmin/clients/new) or edit one (/superadmin/clients/:id/edit) on its
// own page — the same way Employees and Roles work — instead of a form wedged above the list.
@Component({
  selector: 'app-superadmin-client-form',
  standalone: true,
  imports: [CommonModule, LocationPickerComponent, TPipe],
  templateUrl: './superadmin-client-form.component.html',
  styleUrl: './superadmin-client-form.component.scss',
})
export class SuperadminClientFormComponent implements OnInit {
  private readonly service = inject(AdminClientService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly i18n = inject(I18nService);

  clientId = signal<string | null>(null);
  readonly isEdit = computed(() => this.clientId() !== null);
  loadingClient = signal(false);
  loadError = signal('');
  clientCode = signal(''); // CD-0001 — shown on edit; assigned automatically, not editable

  name = signal('');
  vendorName = signal('');
  // Optional details — all may be left blank.
  mobileNumber = signal('');
  address = signal('');
  // The address's place on the map, found automatically as the address is typed and fine-tuned
  // by clicking / dragging the pin — same behaviour as Site / Location on the Assign Task form.
  addressLocation = signal<SiteLatLng | null>(null);
  geocoding = signal(false);
  geocodeNote = signal(''); // an i18n key
  // Once the owner clicks or drags the pin, typing in the address stops moving it — otherwise a
  // carefully placed pin would be overwritten by the next keystroke.
  private pinnedManually = false;
  private geocodeDebounce?: ReturnType<typeof setTimeout>;
  email = signal('');
  wifiEmail = signal('');
  wifiPassword = signal('');
  showPassword = signal(false);

  saving = signal(false);
  formError = signal('');

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.clientId.set(id);
    this.loadingClient.set(true);
    this.service
      .get(id)
      .then(c => {
        this.clientCode.set(c.clientCode);
        this.name.set(c.name);
        this.vendorName.set(c.vendorName);
        this.mobileNumber.set(c.mobileNumber ?? '');
        this.address.set(c.address ?? '');
        // Not pinnedManually: a saved pin may just be an earlier lookup, and correcting the address
        // should be able to move it. It locks as soon as the pin is touched on the map.
        this.addressLocation.set(c.addressLocation ?? null);
        this.email.set(c.email ?? '');
        this.wifiEmail.set(c.wifiEmail ?? '');
        this.wifiPassword.set(c.wifiPassword ?? '');
      })
      .catch(err => this.loadError.set(this.i18n.t(err?.status === 404 ? 'saClients.notFound' : 'saClients.loadOneError')))
      .finally(() => this.loadingClient.set(false));
  }

  msg(v: string): string {
    return v.startsWith('saClients.') ? this.i18n.t(v) : v;
  }

  onAddressInput(value: string): void {
    this.address.set(value);
    clearTimeout(this.geocodeDebounce);
    this.geocodeNote.set('');

    // Coordinates typed directly ("26.9124, 75.7873") are used as they are.
    const coords = parseLatLng(value);
    if (coords) {
      this.addressLocation.set(coords);
      this.geocodeNote.set('saClients.usingCoords');
      return;
    }

    if (this.pinnedManually) return;
    if (!value.trim()) {
      this.addressLocation.set(null);
      return;
    }
    // Debounced well past OpenStreetMap's free-tier one-request-a-second limit: this fires once
    // per pause in typing, not per keystroke.
    this.geocodeDebounce = setTimeout(() => this.findOnMap(value), 1000);
  }

  private async findOnMap(query: string): Promise<void> {
    this.geocoding.set(true);
    try {
      const found = await geocodeAddress(query);
      if (this.pinnedManually || this.address() !== query) return; // stale by the time this answered
      if (!found) {
        this.geocodeNote.set('saClients.mapNoMatch');
        return;
      }
      this.addressLocation.set(found);
      this.geocodeNote.set('');
    } catch {
      this.geocodeNote.set('saClients.lookupFailed');
    } finally {
      this.geocoding.set(false);
    }
  }

  onMapLocation(loc: SiteLatLng): void {
    this.addressLocation.set(loc);
    this.pinnedManually = true;
    this.geocodeNote.set('');
  }

  clearMapLocation(): void {
    this.addressLocation.set(null);
    this.pinnedManually = false;
    this.geocodeNote.set('');
  }

  goBack(): void {
    this.router.navigate(['/superadmin/clients']);
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
      // Always sent in full: on an edit, an emptied box means "clear this detail".
      const payload = {
        name,
        vendorName,
        mobileNumber: this.mobileNumber(),
        address: this.address(),
        addressLocation: this.addressLocation(),
        email: this.email(),
        wifiEmail: this.wifiEmail(),
        wifiPassword: this.wifiPassword(),
      };
      const id = this.clientId();
      if (id) await this.service.update(id, payload);
      else await this.service.create(payload);
      this.goBack();
    } catch (err: any) {
      // Saving an edit with nothing changed isn't an error worth showing — just go back.
      if (err?.status === 409 && err?.error?.message === 'Nothing changed.') {
        this.goBack();
        return;
      }
      this.formError.set(err?.error?.message ?? this.i18n.t('saClients.saveError'));
    } finally {
      this.saving.set(false);
    }
  }
}
