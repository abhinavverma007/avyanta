import { Injectable, signal } from '@angular/core';

// A minimal, app-wide single-slot notice banner — used for things that
// happen to a session from the outside (e.g. the owner changing a
// Supervisor's permissions while they're logged in) rather than as a
// direct response to something the user just clicked.
@Injectable({ providedIn: 'root' })
export class NoticeService {
  readonly message = signal<string | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  show(text: string, durationMs = 6000): void {
    clearTimeout(this.timer);
    this.message.set(text);
    this.timer = setTimeout(() => this.message.set(null), durationMs);
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this.message.set(null);
  }
}
