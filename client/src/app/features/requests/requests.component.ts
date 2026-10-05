import { Component, signal } from '@angular/core';
import { TPipe } from '../../core/i18n/t.pipe';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LeaveComponent } from '../leave/leave.component';
import { ReimbursementsComponent } from '../reimbursements/reimbursements.component';
import { RegularizationComponent } from '../regularization/regularization.component';
import { SalaryAdvanceComponent } from '../salary-advance/salary-advance.component';

type Section = 'leave' | 'reimbursement' | 'regularization' | 'advance';

@Component({
  selector: 'app-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe, LeaveComponent, ReimbursementsComponent, RegularizationComponent, SalaryAdvanceComponent],
  templateUrl: './requests.component.html',
  styleUrl: './requests.component.scss',
})
export class RequestsComponent {
  // A row of tabs stops scaling once there are more of them than fit on a
  // narrow screen (they either wrap awkwardly or scroll off with no visual
  // hint) — so on mobile this list drives a plain <select> instead (see the
  // template); desktop keeps the tab row. Add new request types here once,
  // both views pick it up.
  readonly sectionOptions: { value: Section; label: string }[] = [
    { value: 'leave', label: 'requests.tab.leave' },
    { value: 'reimbursement', label: 'requests.tab.reimbursement' },
    { value: 'regularization', label: 'requests.tab.regularization' },
    { value: 'advance', label: 'requests.tab.advance' },
  ];

  section = signal<Section>('leave');

  setSection(section: Section): void {
    this.section.set(section);
  }
}
