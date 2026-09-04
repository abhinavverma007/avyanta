import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaveComponent } from '../leave/leave.component';
import { ReimbursementsComponent } from '../reimbursements/reimbursements.component';
import { RegularizationComponent } from '../regularization/regularization.component';

type Section = 'leave' | 'reimbursement' | 'regularization';

@Component({
  selector: 'app-requests',
  standalone: true,
  imports: [CommonModule, LeaveComponent, ReimbursementsComponent, RegularizationComponent],
  templateUrl: './requests.component.html',
  styleUrl: './requests.component.scss',
})
export class RequestsComponent {
  section = signal<Section>('leave');

  setSection(section: Section): void {
    this.section.set(section);
  }
}
