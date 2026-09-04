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

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(`${environment.apiUrl}/auth/change-password`, { currentPassword, newPassword }),
    );
    this._state.set({ user: res.user, isAuthenticated: true });
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
  }

  logout(): void {
    this._state.set({ user: null, isAuthenticated: false });
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.router.navigate(['/login']);
  }
}
