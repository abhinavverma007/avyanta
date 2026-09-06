import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SuperadminReimbursementsComponent } from '../reimbursements/superadmin-reimbursements.component';
import { SuperadminLeaveApprovalsComponent } from '../leave-approvals/superadmin-leave-approvals.component';
import { SuperadminRegularizationApprovalsComponent } from '../regularization-approvals/superadmin-regularization-approvals.component';
import { SuperadminAdvanceApprovalsComponent } from '../advance-approvals/superadmin-advance-approvals.component';
import { API_SCOPE } from '../../../core/tokens/api-scope';
import { AuthService } from '../../../core/services/auth.service';

type Section = 'reimbursements' | 'leave' | 'regularization' | 'advance';

const SECTION_PERMISSION: Record<Section, 'approvalsReimbursements' | 'approvalsLeave' | 'approvalsRegularization' | 'approvalsAdvance'> = {
  reimbursements: 'approvalsReimbursements',
  leave: 'approvalsLeave',
  regularization: 'approvalsRegularization',
  advance: 'approvalsAdvance',
};

const SECTION_LABEL: Record<Section, string> = {
  reimbursements: 'Reimbursements',
  leave: 'Leave',
  regularization: 'Fix Attendance',
  advance: 'Advance',
};

@Component({
  selector: 'app-superadmin-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule, SuperadminReimbursementsComponent, SuperadminLeaveApprovalsComponent, SuperadminRegularizationApprovalsComponent, SuperadminAdvanceApprovalsComponent],
  templateUrl: './superadmin-approvals.component.html',
  styleUrl: './superadmin-approvals.component.scss',
})
export class SuperadminApprovalsComponent {
  private readonly isAdminScope = inject(API_SCOPE) === 'admin';
  private readonly authService = inject(AuthService);

  // A true Admin sees all four tabs; a permission-delegated employee only
  // sees the ones their Role actually grants (anyPermissionGuard already
  // ensures at least one is granted before this component ever loads).
  readonly visibleSections: Section[] = this.isAdminScope
    ? ['reimbursements', 'leave', 'regularization', 'advance']
    : (Object.keys(SECTION_PERMISSION) as Section[]).filter(
        s => !!this.authService.user()?.role?.permissions?.[SECTION_PERMISSION[s]],
      );

  // Drives the mobile <select> — the tab row (desktop) is built directly
  // from visibleSections in the template instead, since it also needs the
  // per-tab @if for permission-gating.
  readonly sectionOptions = this.visibleSections.map(s => ({ value: s, label: SECTION_LABEL[s] }));

  section = signal<Section>(this.visibleSections[0] ?? 'reimbursements');

  setSection(section: Section): void {
    this.section.set(section);
  }
}
