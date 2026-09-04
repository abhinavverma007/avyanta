import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Admin, AdminAuthState } from '../models/admin.model';

export const ADMIN_TOKEN_KEY = 'sundesh_admin_token';
const ADMIN_KEY = 'sundesh_admin';

interface AdminLoginResponse {
  token: string;
  admin: Admin;
}

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private _state = signal<AdminAuthState>({ admin: null, isAuthenticated: false });

  readonly admin = computed(() => this._state().admin);
  readonly isAuthenticated = computed(() => this._state().isAuthenticated);

  constructor(private http: HttpClient, private router: Router) {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    const savedAdmin = localStorage.getItem(ADMIN_KEY);
    if (token && savedAdmin) {
      this._state.set({ admin: JSON.parse(savedAdmin), isAuthenticated: true });
    }
  }

  async login(email: string, password: string): Promise<boolean> {
    const res = await firstValueFrom(
      this.http.post<AdminLoginResponse>(`${environment.apiUrl}/admin/auth/login`, { email, password }),
    );
    this._state.set({ admin: res.admin, isAuthenticated: true });
    localStorage.setItem(ADMIN_TOKEN_KEY, res.token);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(res.admin));
    return true;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<AdminLoginResponse>(`${environment.apiUrl}/admin/auth/change-password`, { currentPassword, newPassword }),
    );
    this._state.set({ admin: res.admin, isAuthenticated: true });
    localStorage.setItem(ADMIN_TOKEN_KEY, res.token);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(res.admin));
  }

  logout(): void {
    this._state.set({ admin: null, isAuthenticated: false });
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
    this.router.navigate(['/superadmin']);
  }
}
