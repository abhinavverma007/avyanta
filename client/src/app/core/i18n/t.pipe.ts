import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';

// Usage: {{ 'dashboard.title' | t }}  or  {{ 'leave.days' | t:{ n: 3 } }}
// Impure so it re-runs when the language signal changes.
@Pipe({ name: 't', standalone: true, pure: false })
export class TPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: string, params?: Record<string, string | number | null | undefined>): string {
    return this.i18n.t(key, params);
  }
}
