import { Component, computed, signal } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, TitleCasePipe, FormsModule],
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

  constructor(private auth: AuthService) {}

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
      this.error.set('All fields are required.');
      return;
    }
    if (this.newPassword().length < 6) {
      this.error.set('New password must be at least 6 characters.');
      return;
    }
    if (this.newPassword() !== this.confirmPassword()) {
      this.error.set('New password and confirmation do not match.');
      return;
    }

    this.submitting.set(true);
    try {
      await this.auth.changePassword(this.currentPassword(), this.newPassword());
      this.success.set('Password changed successfully. Logging you out… Please re-login.');
      this.currentPassword.set('');
      this.newPassword.set('');
      this.confirmPassword.set('');
      // Stay disabled through the countdown — the redirect handles resetting the form.
      setTimeout(() => this.auth.logout(), 1800);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Could not change password. Please try again.');
      this.submitting.set(false);
    }
  }

  logout(): void {
    this.auth.logout();
  }
}
