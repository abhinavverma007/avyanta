import { RolePermissions } from './role.model';

export interface UserRole {
  id: string;
  name: string; // 'Employee', 'Supervisor', 'Manager', or any custom role name
  permissions: RolePermissions;
}

export interface User {
  id: string;
  name: string;
  role: UserRole | null;
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
