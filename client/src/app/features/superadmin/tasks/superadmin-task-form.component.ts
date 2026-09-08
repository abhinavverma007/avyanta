import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminTaskService } from '../../../core/services/admin-task.service';
import { AdminEmployeeService } from '../../../core/services/admin-employee.service';
import { SiteLocation, TaskStatus } from '../../../core/models/admin-task.model';
import { AdminEmployee } from '../../../core/models/admin.model';
import { LocationPickerComponent } from '../../../shared/components/location-picker/location-picker.component';
import { istDateString } from '../../../shared/utils/ist-date';

// Matches the backend's IST-based "today" (server/src/utils/istDate.js) —
// a browser-local/UTC date would default this form to yesterday for part
// of the night IST.
function todayStr(): string {
  return istDateString();
}

// "26.9124, 75.7873" (or space-separated) typed directly into Site /
// Location — anchored to the whole string so a real address text (which
// has letters) never accidentally matches this.
const LAT_LNG_RE = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

function parseLatLng(text: string): SiteLocation | null {
  const m = LAT_LNG_RE.exec(text);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function datesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const start = new Date(from);
  const end = new Date(to);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return dates;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

const EMPLOYEE_SEARCH_LIMIT = 20;

// The employee chips/checklist only ever read these 3 fields, whether the
// source is a fresh search result (AdminEmployee, a superset) or an existing
// task's already-assigned employees (AdminTaskEmployee, exactly this shape).
interface PickerEmployee {
  id: string;
  name: string;
  employeeId: string;
}

@Component({
  selector: 'app-superadmin-task-form',
  standalone: true,
  imports: [CommonModule, FormsModule, LocationPickerComponent],
  templateUrl: './superadmin-task-form.component.html',
  styleUrl: './superadmin-task-form.component.scss',
})
export class SuperadminTaskFormComponent implements OnInit {
  taskId = signal<string | null>(null);
  readonly isEditMode = computed(() => this.taskId() !== null);
  loadingTask = signal(false);
  loadError = signal('');

  title = signal('');
  description = signal('');
  site = signal('');
  siteLocation = signal<SiteLocation | null>(null);
  // Once the owner clicks/drags a pin directly, further edits to the Site
  // text stop auto-moving it — otherwise a manually-refined pin (e.g. the
  // exact gate, not just the area) would get clobbered by the next keystroke.
  private pinnedManually = false;
  geocoding = signal(false);
  geocodeNote = signal('');
  private geocodeDebounce?: ReturnType<typeof setTimeout>;

  fromDate = signal(todayStr());
  toDate = signal(todayStr());
  editDate = signal(todayStr());
  status = signal<TaskStatus>('pending');
  saving = signal(false);
  formError = signal('');

  readonly statusOptions: { value: TaskStatus; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
  ];

  employeeSearch = signal('');
  employeeResults = signal<AdminEmployee[]>([]);
  employeeSearchLoading = signal(false);
  selectedEmployees = signal<Map<string, PickerEmployee>>(new Map());
  private employeeSearchDebounce?: ReturnType<typeof setTimeout>;

  readonly selectedDates = computed(() => datesInRange(this.fromDate(), this.toDate()));
  readonly selectedEmployeeList = computed(() => Array.from(this.selectedEmployees().values()));

  constructor(
    private taskService: AdminTaskService,
    private employeeService: AdminEmployeeService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.searchEmployees('');
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.taskId.set(id);
    this.loadingTask.set(true);
    this.taskService
      .get(id)
      .then(task => {
        this.title.set(task.title);
        this.description.set(task.description);
        this.site.set(task.site);
        this.siteLocation.set(task.siteLocation);
        this.status.set(task.status);
        // Not pinnedManually here — a saved location might just be a
        // previous geocode result, not a deliberately fine-tuned pin, and
        // the owner editing Site / Location should still trigger a fresh
        // search. It only locks once they actually touch the map below
        // (see onMapLocation), same as when adding a new task.
        this.editDate.set(task.date);
        const map = new Map<string, PickerEmployee>();
        for (const e of task.employees) map.set(e.id, e);
        this.selectedEmployees.set(map);
      })
      .catch(() => this.loadError.set('Could not load this task. It may have been removed.'))
      .finally(() => this.loadingTask.set(false));
  }

  goBack(): void {
    this.router.navigate(['/superadmin/tasks']);
  }

  onEmployeeSearchInput(value: string): void {
    this.employeeSearch.set(value);
    clearTimeout(this.employeeSearchDebounce);
    this.employeeSearchLoading.set(true);
    this.employeeSearchDebounce = setTimeout(() => this.searchEmployees(value), 300);
  }

  private searchEmployees(search: string): void {
    this.employeeService.list({ search, limit: EMPLOYEE_SEARCH_LIMIT }).then(res => {
      this.employeeResults.set(res.employees.filter(e => e.isActive));
      this.employeeSearchLoading.set(false);
    });
  }

  toggleEmployee(emp: AdminEmployee): void {
    this.selectedEmployees.update(map => {
      const next = new Map(map);
      if (next.has(emp.id)) next.delete(emp.id);
      else next.set(emp.id, emp);
      return next;
    });
  }

  removeSelectedEmployee(id: string): void {
    this.selectedEmployees.update(map => {
      const next = new Map(map);
      next.delete(id);
      return next;
    });
  }

  isSelected(id: string): boolean {
    return this.selectedEmployees().has(id);
  }

  onMapLocation(loc: SiteLocation): void {
    this.siteLocation.set(loc);
    this.pinnedManually = true;
    this.geocodeNote.set('');
  }

  clearMapLocation(): void {
    this.siteLocation.set(null);
    this.pinnedManually = false;
    this.geocodeNote.set('');
  }

  onSiteInput(value: string): void {
    this.site.set(value);
    clearTimeout(this.geocodeDebounce);
    this.geocodeNote.set('');

    // Typed coordinates directly (e.g. "26.9124, 75.7873") — use them as-is,
    // no need to round-trip through the geocoder for something this exact.
    const coords = parseLatLng(value);
    if (coords) {
      this.siteLocation.set(coords);
      this.geocodeNote.set('Using the coordinates you typed.');
      return;
    }

    if (this.pinnedManually) return;
    if (!value.trim()) {
      this.siteLocation.set(null);
      return;
    }
    // Debounced well past OpenStreetMap Nominatim's free-tier 1 req/sec
    // limit — this fires at most once per pause in typing, not per keystroke.
    this.geocodeDebounce = setTimeout(() => this.geocodeSite(value), 1000);
  }

  private async geocodeSite(query: string): Promise<void> {
    this.geocoding.set(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`,
      );
      const results: Array<{ lat: string; lon: string }> = await res.json();
      if (this.pinnedManually || this.site() !== query) return; // stale by the time this resolved

      if (results.length === 0) {
        this.geocodeNote.set('No match found for that — pin the site manually on the map below.');
        return;
      }
      this.siteLocation.set({ lat: Number(results[0].lat), lng: Number(results[0].lon) });
      this.geocodeNote.set('');
    } catch {
      this.geocodeNote.set('Could not look up that location — pin the site manually on the map below.');
    } finally {
      this.geocoding.set(false);
    }
  }

  async submitForm(): Promise<void> {
    this.formError.set('');

    if (!this.title().trim()) {
      this.formError.set('Title is required.');
      return;
    }
    const employeeIds = Array.from(this.selectedEmployees().keys());
    if (employeeIds.length === 0) {
      this.formError.set('Select at least one employee.');
      return;
    }

    const id = this.taskId();
    if (id) {
      if (!this.editDate()) {
        this.formError.set('Pick a date.');
        return;
      }
      this.saving.set(true);
      try {
        await this.taskService.update(id, {
          title: this.title(),
          description: this.description(),
          site: this.site(),
          siteLocation: this.siteLocation(),
          date: this.editDate(),
          employeeIds,
          status: this.status(),
        });
        this.router.navigate(['/superadmin/tasks']);
      } catch (err: any) {
        this.formError.set(err?.error?.message ?? 'Could not save changes. Please try again.');
      } finally {
        this.saving.set(false);
      }
      return;
    }

    const dates = this.selectedDates();
    if (dates.length === 0) {
      this.formError.set('Pick a valid date range.');
      return;
    }

    this.saving.set(true);
    try {
      await this.taskService.create({
        title: this.title(),
        description: this.description(),
        site: this.site(),
        siteLocation: this.siteLocation() ?? undefined,
        dates,
        employeeIds,
      });
      this.router.navigate(['/superadmin/tasks']);
    } catch (err: any) {
      this.formError.set(err?.error?.message ?? 'Could not assign task. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }
}
