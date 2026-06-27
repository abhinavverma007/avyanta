export type UserRole = 'employee' | 'field_worker' | 'vendor' | 'customer' | 'director';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  designation: string;
  department: string;
  email: string;
  phone: string;
  avatar?: string;
  employeeId: string;
  joinDate: string;
  location: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
