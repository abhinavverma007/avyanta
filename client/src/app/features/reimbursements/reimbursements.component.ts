import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReimbursementService } from '../../core/services/reimbursement.service';
import { Reimbursement, ReimbursementCategory } from '../../core/models/reimbursement.model';

@Component({
  selector: 'app-reimbursements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reimbursements.component.html',
  styleUrl: './reimbursements.component.scss',
})
export class ReimbursementsComponent implements OnInit {
  readonly categories: ReimbursementCategory[] = ['petrol', 'food', 'travel', 'other'];

  claims = signal<Reimbursement[]>([]);
  loading = signal(true);

  category = signal<ReimbursementCategory>('petrol');
  amount = signal<number | null>(null);
  description = signal('');
  date = signal(new Date().toISOString().slice(0, 10));
  submitting = signal(false);
  error = signal('');
  success = signal('');

  constructor(private reimbursementService: ReimbursementService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.reimbursementService.mine().then(list => {
      this.claims.set(list);
      this.loading.set(false);
    });
  }

  categoryLabel(category: string): string {
    const map: Record<string, string> = { petrol: 'Petrol', food: 'Food', travel: 'Travel', other: 'Other' };
    return map[category] ?? category;
  }

  onAmountInput(value: string): void {
    const digits = value.replace(/\D/g, '');
    this.amount.set(digits ? Number(digits) : null);
  }

  formatMoney(value: number | null): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '';
    return value.toLocaleString('en-IN');
  }

  async submitClaim(): Promise<void> {
    this.error.set('');
    this.success.set('');

    if (!this.amount() || this.amount()! <= 0) {
      this.error.set('Enter an amount greater than 0.');
      return;
    }

    this.submitting.set(true);
    try {
      await this.reimbursementService.create({
        category: this.category(),
        amount: this.amount()!,
        description: this.description(),
        date: this.date(),
      });
      this.success.set('Claim submitted — you\'ll see the review status below once it\'s processed.');
      this.amount.set(null);
      this.description.set('');
      this.load();
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Could not submit claim. Please try again.');
    } finally {
      this.submitting.set(false);
    }
  }
}
