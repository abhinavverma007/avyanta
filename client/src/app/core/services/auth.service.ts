import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, AuthState } from '../models/user.model';

const TOKEN_KEY = 'sundesh_token';
const USER_KEY = 'sundesh_user';

interface LoginResponse {
  token: string;
  user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _state = signal<AuthState>({ user: null, isAuthenticated: false });

  readonly user = computed(() => this._state().user);
  readonly isAuthenticated = computed(() => this._state().isAuthenticated);

  constructor(private http: HttpClient, private router: Router) {
    const token = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    if (token && savedUser) {
      this._state.set({ user: JSON.parse(savedUser), isAuthenticated: true });
    }
  }

  async login(_role: string, email: string, password: string): Promise<boolean> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password }),
    );
    this._state.set({ user: res.user, isAuthenticated: true });
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    return true;
  }

  // Re-fetches the current employee's own record (including their Role's
  // live permissions) and refreshes the cached copy in memory + localStorage.
  // Used to bring a stale session back in sync after the owner changes a
  // Role's permissions while that employee is already logged in — the
  // backend enforces the new permissions immediately on its own, this just
  // updates the client-side nav/guards to match without forcing a re-login.
  async refreshUser(): Promise<void> {
    const res = await firstValueFrom(this.http.get<{ user: User }>(`${environment.apiUrl}/auth/me`));
    this._state.update(s => ({ ...s, user: res.user }));
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(`${environment.apiUrl}/auth/change-password`, { currentPassword, newPassword }),
    );
    this._state.set({ user: res.user, isAuthenticated: true });
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
  }

  // Clears the session without navigating anywhere — used when the *other*
  // login (Admin, at this same unified /login page) succeeds, so a leftover
  // Employee session from earlier testing can't linger (see
  // AdminAuthService.clearLocalSession and login.component.ts, which does
  // the same in reverse).
  clearLocalSession(): void {
    this._state.set({ user: null, isAuthenticated: false });
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  logout(): void {
    this.clearLocalSession();
    this.router.navigate(['/login']);
  }
}
