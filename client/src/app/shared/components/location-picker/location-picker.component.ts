import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core';
import * as L from 'leaflet';

// Leaflet's default marker images resolve relative to the bundled JS file,
// which breaks under Angular's build — point them at the same version's
// files on a free public CDN instead (no key, no billing).
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export interface SiteLatLng {
  lat: number;
  lng: number;
}

const DEFAULT_CENTER: SiteLatLng = { lat: 22.9734, lng: 78.6569 }; // roughly the geographic centre of India
const DEFAULT_ZOOM = 5;
const PICKED_ZOOM = 15;

// Free, no-API-key map: OpenStreetMap tiles + Leaflet. Two modes in one
// component so both the "pick a site while assigning a task" form and the
// "show where the site is" read-only view share one implementation:
//   - editable: click anywhere (or drag the marker) to set the location
//   - read-only: small static map centred on the given point, no controls
@Component({
  selector: 'app-location-picker',
  standalone: true,
  template: `<div class="location-map" [class.editable]="editable" #mapEl></div>`,
  styles: [`
    .location-map { width: 100%; border-radius: var(--radius-md, 8px); overflow: hidden; }
    .location-map.editable { height: 260px; border: 1px solid var(--border, #d9dee5); }
    .location-map:not(.editable) { height: 140px; }
  `],
})
export class LocationPickerComponent implements OnChanges, OnDestroy {
  @Input() location: SiteLatLng | null = null;
  @Input() editable = false;
  @Output() locationChange = new EventEmitter<SiteLatLng>();

  @ViewChild('mapEl', { static: true }) private mapEl!: ElementRef<HTMLDivElement>;

  private map?: L.Map;
  private marker?: L.Marker;
  private intersectionObserver?: IntersectionObserver;

  ngAfterViewInit(): void {
    // A read-only map only ever appears inside a task list, where several
    // can render on one page (owner: up to 10, employee: up to 3) — each
    // one is a live Leaflet instance that fires several OSM tile requests
    // the moment it's created, whether or not it's actually on screen yet.
    // Defer that cost until the row is about to scroll into view. The
    // editable picker (the Assign Task form) is always the only instance
    // on its page and needs to be usable immediately, so it stays eager.
    if (!this.editable && 'IntersectionObserver' in window) {
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            this.intersectionObserver?.disconnect();
            this.intersectionObserver = undefined;
            this.initMap();
          }
        },
        { rootMargin: '200px' },
      );
      this.intersectionObserver.observe(this.mapEl.nativeElement);
      return;
    }

    this.initMap();
  }

  private initMap(): void {
    const start = this.location ?? DEFAULT_CENTER;
    this.map = L.map(this.mapEl.nativeElement, {
      center: [start.lat, start.lng],
      zoom: this.location ? PICKED_ZOOM : DEFAULT_ZOOM,
      zoomControl: this.editable,
      dragging: this.editable,
      scrollWheelZoom: this.editable,
      doubleClickZoom: this.editable,
      touchZoom: this.editable,
      attributionControl: this.editable,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    if (this.location) {
      this.placeMarker(this.location, false);
    }

    if (this.editable) {
      this.map.on('click', (e: L.LeafletMouseEvent) => this.setLocation(e.latlng.lat, e.latlng.lng));
    }

    // Leaflet needs a laid-out container to size its tiles correctly — if
    // this map starts inside a just-opened form/section, its container's
    // size isn't final on the frame this constructor runs.
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['location'] && this.map) {
      if (this.location) {
        this.map.setView([this.location.lat, this.location.lng], PICKED_ZOOM);
        this.placeMarker(this.location, false);
      } else if (this.marker) {
        this.map.removeLayer(this.marker);
        this.marker = undefined;
      }
    }
  }

  ngOnDestroy(): void {
    this.intersectionObserver?.disconnect();
    this.map?.remove();
  }

  useMyLocation(): void {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      this.setLocation(pos.coords.latitude, pos.coords.longitude);
      this.map?.setView([pos.coords.latitude, pos.coords.longitude], PICKED_ZOOM);
    });
  }

  private setLocation(lat: number, lng: number): void {
    this.placeMarker({ lat, lng }, true);
    this.locationChange.emit({ lat, lng });
  }

  private placeMarker(loc: SiteLatLng, draggable: boolean): void {
    if (!this.map) return;
    if (this.marker) {
      this.marker.setLatLng([loc.lat, loc.lng]);
      this.marker.dragging?.[draggable ? 'enable' : 'disable']();
      return;
    }
    this.marker = L.marker([loc.lat, loc.lng], { draggable: this.editable }).addTo(this.map);
    if (this.editable) {
      this.marker.on('dragend', () => {
        const pos = this.marker!.getLatLng();
        this.locationChange.emit({ lat: pos.lat, lng: pos.lng });
      });
    }
  }
}
