import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { User, UserRole, AuthState } from '../models/user.model';

const MOCK_USERS: Record<UserRole, User> = {
  employee: {
    id: 'u001',
    name: 'Rahul Sharma',
    role: 'employee',
    designation: 'Senior Solar Technician',
    department: 'Operations',
    email: 'rahul.sharma@sundesh.in',
    phone: '+91 98765 43210',
    employeeId: 'SDE-2847',
    joinDate: '2021-04-15',
    location: 'Jaipur, Rajasthan',
  },
  field_worker: {
    id: 'u002',
    name: 'Priya Nair',
    role: 'field_worker',
    designation: 'Field Installation Engineer',
    department: 'Field Services',
    email: 'priya.nair@sundesh.in',
    phone: '+91 87654 32109',
    employeeId: 'SFW-1193',
    joinDate: '2022-01-10',
    location: 'Bengaluru, Karnataka',
  },
  vendor: {
    id: 'u003',
    name: 'Suresh Patel',
    role: 'vendor',
    designation: 'Partner Account Manager',
    department: 'Vendor Relations',
    email: 'suresh@solarvend.co.in',
    phone: '+91 76543 21098',
    employeeId: 'VND-0421',
    joinDate: '2020-08-20',
    location: 'Ahmedabad, Gujarat',
  },
  customer: {
    id: 'u004',
    name: 'Ananya Krishnan',
    role: 'customer',
    designation: 'Home Owner',
    department: '',
    email: 'ananya.k@gmail.com',
    phone: '+91 65432 10987',
    employeeId: 'CUS-7731',
    joinDate: '2023-03-01',
    location: 'Chennai, Tamil Nadu',
  },
  director: {
    id: 'u005',
    name: 'Vikram Mehta',
    role: 'director',
    designation: 'Executive Director — Operations',
    department: 'Executive Leadership',
    email: 'vikram.mehta@sundesh.in',
    phone: '+91 54321 09876',
    employeeId: 'DIR-0001',
    joinDate: '2019-01-01',
    location: 'Mumbai, Maharashtra',
  },
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _state = signal<AuthState>({ user: null, isAuthenticated: false });

  readonly user = computed(() => this._state().user);
  readonly isAuthenticated = computed(() => this._state().isAuthenticated);

  constructor(private router: Router) {
    const saved = sessionStorage.getItem('sundesh_user');
    if (saved) {
      this._state.set({ user: JSON.parse(saved), isAuthenticated: true });
    }
  }

  login(role: UserRole, _email: string, _password: string): Promise<boolean> {
    return new Promise(resolve => {
      setTimeout(() => {
        const user = MOCK_USERS[role];
        this._state.set({ user, isAuthenticated: true });
        sessionStorage.setItem('sundesh_user', JSON.stringify(user));
        resolve(true);
      }, 800);
    });
  }

  logout(): void {
    this._state.set({ user: null, isAuthenticated: false });
    sessionStorage.removeItem('sundesh_user');
    this.router.navigate(['/login']);
  }
}
