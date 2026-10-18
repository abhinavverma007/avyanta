import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DailyReportService } from '../../core/services/daily-report.service';
import { PROBLEMS, SubmitReportPayload, WORK_TYPES } from '../../core/models/daily-report.model';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';

// The end-of-day work report — a worker's written replacement for a daily
// stand-up call. Opens right after punch-out; mostly taps, about a minute.
// It can be skipped ("do it later") and is never a gate on punching in.
@Component({
  selector: 'app-daily-report',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './daily-report.component.html',
  styleUrl: './daily-report.component.scss',
})
export class DailyReportComponent implements OnInit {
  private readonly service = inject(DailyReportService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly i18n = inject(I18nService);

  readonly workTypes = WORK_TYPES;
  readonly problemOptions = PROBLEMS;

  date = '';
  loading = signal(true);
  loadError = signal('');
  punchedIn = signal(true);
  isEdit = signal(false);

  // Today's assigned jobs — shown for context only; they're linked to the report automatically.
  jobs = signal<{ taskId: string; title: string; site: string }[]>([]);
  selectedWork = signal<string[]>([]);
  problems = signal<string[]>([]); // 'none' on its own, or one or more real problems
  problemNote = signal('');
  safety = signal<boolean | null>(null);
  safetyNote = signal('');
  messageToOwner = signal('');

  saving = signal(false);
  formError = signal('');

  ngOnInit(): void {
    this.date = this.route.snapshot.queryParamMap.get('date') ?? '';
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    // No date given = today; the server tells us which date that is.
    this.service
      .get(this.date || 'today')
      .then(data => {
        this.date = data.date;
        this.punchedIn.set(data.punchedIn);
        const saved = data.report;
        this.jobs.set(data.tasks.map(t => ({ taskId: t.id, title: t.title, site: t.site })));
        if (saved) {
          this.isEdit.set(true);
          this.selectedWork.set([...saved.workTypes]);
          this.problems.set([...saved.problems]);
          this.problemNote.set(saved.problemNote);
          this.safety.set(saved.safetyIncident);
          this.safetyNote.set(saved.safetyNote);
          this.messageToOwner.set(saved.messageToOwner);
        }
      })
      // A past day says it has ended (the server's message); anything else is a generic error.
      .catch(err => this.loadError.set(err?.status === 400 && err?.error?.message ? err.error.message : this.i18n.t('dailyReport.loadError')))
      .finally(() => this.loading.set(false));
  }

  isWorkSelected(k: string): boolean {
    return this.selectedWork().includes(k);
  }

  toggleWork(k: string): void {
    this.selectedWork.update(list => (list.includes(k) ? list.filter(x => x !== k) : [...list, k]));
  }

  hasProblem(k: string): boolean {
    return this.problems().includes(k);
  }

  // "No problem" excludes everything else, and picking a real problem clears it.
  toggleProblem(k: string): void {
    if (k === 'none') {
      this.problems.set(this.hasProblem('none') ? [] : ['none']);
      this.problemNote.set('');
      return;
    }
    this.problems.update(list => {
      const without = list.filter(x => x !== 'none');
      return without.includes(k) ? without.filter(x => x !== k) : [...without, k];
    });
  }

  get hasRealProblem(): boolean {
    return this.problems().some(p => p !== 'none');
  }

  // The first thing wrong with the form, as a translated message — or null.
  private validate(): string | null {
    if (this.selectedWork().length === 0) return this.i18n.t('dailyReport.errWork');
    if (this.problems().length === 0) return this.i18n.t('dailyReport.errProblem');
    if (this.safety() === null) return this.i18n.t('dailyReport.errSafety');
    if (this.safety() === true && !this.safetyNote().trim()) return this.i18n.t('dailyReport.errSafetyNote');
    return null;
  }

  async submit(): Promise<void> {
    if (this.saving()) return;
    const problem = this.validate();
    if (problem) {
      this.formError.set(problem);
      return;
    }
    this.formError.set('');

    const payload: SubmitReportPayload = {
      workTypes: this.selectedWork(),
      problems: this.problems(),
      problemNote: this.hasRealProblem ? this.problemNote().trim() : '',
      safetyIncident: this.safety() === true,
      safetyNote: this.safety() === true ? this.safetyNote().trim() : '',
      messageToOwner: this.messageToOwner().trim(),
    };

    this.saving.set(true);
    try {
      await this.service.submit(this.date, payload);
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.formError.set(err?.error?.message ?? this.i18n.t('dailyReport.saveError'));
    } finally {
      this.saving.set(false);
    }
  }

  later(): void {
    this.router.navigate(['/dashboard']);
  }
}
