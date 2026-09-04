import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminAuthService } from '../../../core/services/admin-auth.service';
import { isValidEmail } from '../../../core/utils/validators';

@Component({
  selector: 'app-superadmin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './superadmin-login.component.html',
  styleUrl: './superadmin-login.component.scss',
})
export class SuperadminLoginComponent implements OnInit {
  email = signal('');
  password = signal('');
  showPassword = signal(false);
  loading = signal(false);
  error = signal('');

  constructor(private auth: AdminAuthService, private router: Router) {}

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/superadmin/employees']);
    }
  }

  async onSubmit(): Promise<void> {
    this.error.set('');
    if (!isValidEmail(this.email())) {
      this.error.set('Enter a valid email address.');
      return;
    }

    this.loading.set(true);
    try {
      await this.auth.login(this.email(), this.password());
      this.router.navigate(['/superadmin/employees']);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Invalid credentials. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
