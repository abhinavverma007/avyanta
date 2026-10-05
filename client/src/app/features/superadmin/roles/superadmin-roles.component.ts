import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import { AdminRoleService } from '../../../core/services/admin-role.service';
import { PERMISSION_CATALOG, Role, RoleEmployee, RolePermissions } from '../../../core/models/role.model';

@Component({
  selector: 'app-superadmin-roles',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TPipe],
  templateUrl: './superadmin-roles.component.html',
  styleUrl: './superadmin-roles.component.scss',
})
export class SuperadminRolesComponent implements OnInit {
  readonly catalog = PERMISSION_CATALOG;

  roles = signal<Role[]>([]);
  loading = signal(true);
  expandedId = signal<string | null>(null);

  // The default "Employee" role is deliberately hidden from this page — a
  // plain employee never offloads any superadmin work, so there's nothing
  // to configure for it here. It's still assignable from the Add Employee
  // form (that dropdown fetches roles independently), just not manageable
  // as a delegated role. isSystem is only ever true for that one role.
  readonly visibleRoles = computed(() => this.roles().filter(r => !r.isSystem));

  // Local draft permissions for whichever role is currently expanded —
  // edited via the toggles, only sent to the server on Save.
  draftPermissions = signal<RolePermissions | null>(null);
  saving = signal(false);
  actionError = signal('');

  // Who actually has the currently-expanded role — fetched on demand since
  // the list itself only carries a count (see role.employeeCount).
  roleEmployees = signal<RoleEmployee[] | null>(null);
  roleEmployeesLoading = signal(false);

  constructor(private roleService: AdminRoleService, readonly i18n: I18nService) {}

  // Signal holds either an i18n key (ours) or a raw server message.
  msg(v: string): string {
    return v.startsWith('saRoles.') ? this.i18n.t(v) : v;
  }

  permLabel(p: { key: string; label: string }): string {
    const k = 'saRoles.perm.' + p.key + '.label';
    const v = this.i18n.t(k);
    return v === k ? p.label : v;
  }

  permDesc(p: { key: string; description: string }): string {
    const k = 'saRoles.perm.' + p.key + '.desc';
    const v = this.i18n.t(k);
    return v === k ? p.description : v;
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.roleService.list().then(roles => {
      this.roles.set(roles);
      this.loading.set(false);
    });
  }

  toggleExpand(role: Role): void {
    this.actionError.set('');
    if (this.expandedId() === role.id) {
      this.expandedId.set(null);
      this.draftPermissions.set(null);
      this.roleEmployees.set(null);
      return;
    }
    this.expandedId.set(role.id);
    this.draftPermissions.set({ ...role.permissions });

    this.roleEmployees.set(null);
    this.roleEmployeesLoading.set(true);
    this.roleService.employees(role.id).then(employees => {
      this.roleEmployees.set(employees);
      this.roleEmployeesLoading.set(false);
    });
  }

  togglePermission(key: keyof RolePermissions): void {
    this.draftPermissions.update(p => (p ? { ...p, [key]: !p[key] } : p));
  }

  async saveDraft(role: Role): Promise<void> {
    const draft = this.draftPermissions();
    if (!draft) return;
    this.saving.set(true);
    this.actionError.set('');
    try {
      const updated = await this.roleService.update(role.id, { permissions: draft });
      this.roles.update(list => list.map(r => (r.id === role.id ? updated : r)));
      this.expandedId.set(null);
      this.draftPermissions.set(null);
      this.roleEmployees.set(null);
    } catch (err: any) {
      this.actionError.set(err?.error?.message ?? 'saRoles.errSave');
    } finally {
      this.saving.set(false);
    }
  }

  async removeRole(role: Role): Promise<void> {
    this.actionError.set('');
    try {
      await this.roleService.remove(role.id);
      this.roles.update(list => list.filter(r => r.id !== role.id));
    } catch (err: any) {
      this.actionError.set(err?.error?.message ?? 'saRoles.errDelete');
    }
  }
}
