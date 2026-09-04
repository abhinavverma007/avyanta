import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SuperadminReimbursementsComponent } from '../reimbursements/superadmin-reimbursements.component';
import { SuperadminLeaveApprovalsComponent } from '../leave-approvals/superadmin-leave-approvals.component';
import { SuperadminRegularizationApprovalsComponent } from '../regularization-approvals/superadmin-regularization-approvals.component';

type Section = 'reimbursements' | 'leave' | 'regularization';

@Component({
  selector: 'app-superadmin-approvals',
  standalone: true,
  imports: [CommonModule, SuperadminReimbursementsComponent, SuperadminLeaveApprovalsComponent, SuperadminRegularizationApprovalsComponent],
  templateUrl: './superadmin-approvals.component.html',
  styleUrl: './superadmin-approvals.component.scss',
})
export class SuperadminApprovalsComponent {
  section = signal<Section>('reimbursements');

  setSection(section: Section): void {
    this.section.set(section);
  }
}
