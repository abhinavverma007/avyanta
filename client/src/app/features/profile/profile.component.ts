import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent {
  readonly user = computed(() => this.auth.user());

  showChangePassword = signal(false);
  currentPassword = signal('');
  newPassword = signal('');
  confirmPassword = signal('');
  showCurrentPassword = signal(false);
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);
  submitting = signal(false);
  error = signal('');
  success = signal('');

  showUpiForm = signal(false);
  upiId = signal('');
  upiSubmitting = signal(false);
  upiError = signal('');
  upiSuccess = signal('');

  constructor(private auth: AuthService, readonly i18n: I18nService) {}

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  }

  toggleChangePassword(): void {
    this.showChangePassword.update(v => !v);
    this.error.set('');
    this.success.set('');
    this.currentPassword.set('');
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.showCurrentPassword.set(false);
    this.showNewPassword.set(false);
    this.showConfirmPassword.set(false);
  }

  async submitChangePassword(): Promise<void> {
    this.error.set('');
    this.success.set('');

    if (!this.currentPassword() || !this.newPassword() || !this.confirmPassword()) {
      this.error.set(this.i18n.t('profile.err.required'));
      return;
    }
    if (this.newPassword().length < 6) {
      this.error.set(this.i18n.t('profile.err.minLength'));
      return;
    }
    if (this.newPassword() !== this.confirmPassword()) {
      this.error.set(this.i18n.t('profile.err.mismatch'));
      return;
    }

    this.submitting.set(true);
    try {
      await this.auth.changePassword(this.currentPassword(), this.newPassword());
      this.success.set(this.i18n.t('profile.pwChanged'));
      this.currentPassword.set('');
      this.newPassword.set('');
      this.confirmPassword.set('');
      // Stay disabled through the countdown — the redirect handles resetting the form.
      setTimeout(() => this.auth.logout(), 1800);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? this.i18n.t('profile.err.pwFail'));
      this.submitting.set(false);
    }
  }

  logout(): void {
    this.auth.logout();
  }

  toggleUpiForm(): void {
    this.showUpiForm.update(v => !v);
    this.upiError.set('');
    this.upiSuccess.set('');
    this.upiId.set(this.user()?.upiId ?? '');
  }

  private closeUpiForm(): void {
    this.showUpiForm.set(false);
    this.upiError.set('');
    this.upiSuccess.set('');
  }

  async submitUpi(): Promise<void> {
    this.upiError.set('');
    this.upiSuccess.set('');

    const value = this.upiId().trim();
    if (!value) {
      this.upiError.set(this.i18n.t('profile.err.upiRequired'));
      return;
    }

    this.upiSubmitting.set(true);
    try {
      await this.auth.updateUpi(value);
      this.upiSuccess.set(this.i18n.t('profile.upiUpdated'));
      // Brief pause so the success message is actually seen before the form
      // collapses back — the updated value is now visible in Personal
      // Details above, so there's nothing left to do here once it's read.
      setTimeout(() => this.closeUpiForm(), 1200);
    } catch (err: any) {
      this.upiError.set(err?.error?.message ?? this.i18n.t('profile.err.upiFail'));
    } finally {
      this.upiSubmitting.set(false);
    }
  }
}
