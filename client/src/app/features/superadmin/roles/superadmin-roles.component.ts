import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminRoleService } from '../../../core/services/admin-role.service';
import { PERMISSION_CATALOG, Role, RolePermissions } from '../../../core/models/role.model';

@Component({
  selector: 'app-superadmin-roles',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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

  showCreateForm = signal(false);
  newRoleName = signal('');
  creating = signal(false);
  createError = signal('');

  constructor(private roleService: AdminRoleService) {}

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
      return;
    }
    this.expandedId.set(role.id);
    this.draftPermissions.set({ ...role.permissions });
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
    } catch (err: any) {
      this.actionError.set(err?.error?.message ?? 'Could not save. Please try again.');
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
      this.actionError.set(err?.error?.message ?? 'Could not delete role.');
    }
  }

  openCreateForm(): void {
    this.newRoleName.set('');
    this.createError.set('');
    this.showCreateForm.set(true);
  }

  async createRole(): Promise<void> {
    this.createError.set('');
    if (!this.newRoleName().trim()) {
      this.createError.set('A role name is required.');
      return;
    }
    this.creating.set(true);
    try {
      const role = await this.roleService.create({ name: this.newRoleName().trim() });
      this.roles.update(list => [...list, role]);
      this.showCreateForm.set(false);
    } catch (err: any) {
      this.createError.set(err?.error?.message ?? 'Could not create role. Please try again.');
    } finally {
      this.creating.set(false);
    }
  }
}
