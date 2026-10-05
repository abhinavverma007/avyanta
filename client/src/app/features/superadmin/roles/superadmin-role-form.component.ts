import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import { AdminRoleService } from '../../../core/services/admin-role.service';

// Create-only — editing an existing role's permissions still happens
// inline on the Roles & Permissions list (see superadmin-roles.component),
// same as before. This is just "+ Add Role" moved to its own route with a
// "Back to Roles & Permissions" link, matching the Assign Task /
// superadmin/tasks/new pattern (see superadmin-task-form.component.ts).
@Component({
  selector: 'app-superadmin-role-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe],
  templateUrl: './superadmin-role-form.component.html',
  styleUrl: './superadmin-role-form.component.scss',
})
export class SuperadminRoleFormComponent {
  name = signal('');
  creating = signal(false);
  error = signal('');

  constructor(private roleService: AdminRoleService, private router: Router, readonly i18n: I18nService) {}

  // Signal holds either an i18n key (ours) or a raw server message.
  msg(v: string): string {
    return v.startsWith('saRoleForm.') ? this.i18n.t(v) : v;
  }

  goBack(): void {
    this.router.navigate(['/superadmin/roles']);
  }

  async createRole(): Promise<void> {
    this.error.set('');
    if (!this.name().trim()) {
      this.error.set('saRoleForm.errName');
      return;
    }
    this.creating.set(true);
    try {
      await this.roleService.create({ name: this.name().trim() });
      this.router.navigate(['/superadmin/roles']);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'saRoleForm.errCreate');
      this.creating.set(false);
    }
  }
}
