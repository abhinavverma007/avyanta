import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { ReimbursementService } from '../../core/services/reimbursement.service';
import { Reimbursement, ReimbursementCategory } from '../../core/models/reimbursement.model';
import { istDateString } from '../../shared/utils/ist-date';

@Component({
  selector: 'app-reimbursements',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe],
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
  // Matches the backend's IST-based "today" (server/src/utils/istDate.js) —
  // a browser-local/UTC date sits a full calendar day behind IST for part
  // of the night, which would otherwise default this to yesterday.
  date = signal(istDateString());
  submitting = signal(false);
  error = signal('');
  success = signal('');

  readonly i18n = inject(I18nService);

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
    return ['petrol', 'food', 'travel', 'other'].includes(category) ? this.i18n.t('reimb.cat.' + category) : category;
  }

  // Nudges what's actually useful to write, per category, instead of one
  // generic placeholder for every claim type.
  readonly descriptionPlaceholder = computed(() => {
    const map: Record<ReimbursementCategory, string> = {
      petrol: this.i18n.t('reimb.ph.petrol'),
      food: this.i18n.t('reimb.ph.food'),
      travel: this.i18n.t('reimb.ph.travel'),
      other: this.i18n.t('reimb.ph.other'),
    };
    return map[this.category()];
  });

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
      this.error.set(this.i18n.t('requests.errAmount'));
      return;
    }
    if (!this.description().trim()) {
      this.error.set(this.i18n.t('reimb.errDesc'));
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
      this.success.set(this.i18n.t('reimb.success'));
      this.amount.set(null);
      this.description.set('');
      this.load();
    } catch (err: any) {
      this.error.set(err?.error?.message ?? this.i18n.t('reimb.errSubmit'));
    } finally {
      this.submitting.set(false);
    }
  }
}
