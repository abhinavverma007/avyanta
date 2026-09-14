import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminRoleService } from '../../../core/services/admin-role.service';

// Create-only — editing an existing role's permissions still happens
// inline on the Roles & Permissions list (see superadmin-roles.component),
// same as before. This is just "+ Add Role" moved to its own route with a
// "Back to Roles & Permissions" link, matching the Assign Task /
// superadmin/tasks/new pattern (see superadmin-task-form.component.ts).
@Component({
  selector: 'app-superadmin-role-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './superadmin-role-form.component.html',
  styleUrl: './superadmin-role-form.component.scss',
})
export class SuperadminRoleFormComponent {
  name = signal('');
  creating = signal(false);
  error = signal('');

  constructor(private roleService: AdminRoleService, private router: Router) {}

  goBack(): void {
    this.router.navigate(['/superadmin/roles']);
  }

  async createRole(): Promise<void> {
    this.error.set('');
    if (!this.name().trim()) {
      this.error.set('A role name is required.');
      return;
    }
    this.creating.set(true);
    try {
      await this.roleService.create({ name: this.name().trim() });
      this.router.navigate(['/superadmin/roles']);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Could not create role. Please try again.');
      this.creating.set(false);
    }
  }
}
