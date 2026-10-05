import { Injectable, computed, signal } from '@angular/core';
import { Lang, TRANSLATIONS } from './translations';

const LANG_KEY = 'sundesh_lang';

// Language is a per-device preference (kept in localStorage) so it applies to
// every kind of session — plain employee, delegated Supervisor/Manager and
// the owner — and survives logout/login and the hard navigations used when
// switching between the employee and management views.
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly _lang = signal<Lang>(this.readSaved());

  readonly lang = this._lang.asReadonly();
  readonly isHindi = computed(() => this._lang() === 'hi');

  constructor() {
    document.documentElement.lang = this._lang();
  }

  setLang(lang: Lang): void {
    this._lang.set(lang);
    document.documentElement.lang = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* storage blocked — in-memory only */ }
  }

  toggle(): void {
    this.setLang(this._lang() === 'en' ? 'hi' : 'en');
  }

  // Reads the signal, so any template/computed calling this re-evaluates when
  // the language changes. Falls back to English, then to the key itself, so a
  // missing translation never renders blank.
  t(key: string, params?: Record<string, string | number | null | undefined>): string {
    const text = TRANSLATIONS[this._lang()][key] ?? TRANSLATIONS.en[key] ?? key;
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name] ?? '') : m));
  }

  private readSaved(): Lang {
    try {
      return localStorage.getItem(LANG_KEY) === 'hi' ? 'hi' : 'en';
    } catch {
      return 'en';
    }
  }
}
