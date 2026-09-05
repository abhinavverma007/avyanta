export interface Admin {
  id: string;
  name: string;
  email: string;
}

export interface AdminAuthState {
  admin: Admin | null;
  isAuthenticated: boolean;
}

export interface AdminEmployee {
  id: string;
  name: string;
  email: string;
  designation: string;
  department: string;
  phone: string;
  employeeId: string;
  joinDate: string;
  location: string;
  aadhaarNumber: string; // 12 digits, no hyphens
  upiId: string;
  shiftStart: string;
  salaryMonthly: number;
  paidLeavesPerMonth: number;
  isActive: boolean;
  createdAt: string;
}

// No email or employee ID here — the server generates both (see
// AdminEmployeeService.previewEmail for the live preview shown in the form).
export interface CreateEmployeePayload {
  name: string;
  password?: string;
  designation?: string;
  department?: string;
  phone?: string;
  joinDate: string;
  location?: string;
  aadhaarNumber?: string;
  upiId?: string;
  shiftStart?: string;
  salaryMonthly?: number;
  paidLeavesPerMonth?: number;
}

export interface UpdateEmployeePayload {
  name?: string;
  designation?: string;
  department?: string;
  phone?: string;
  location?: string;
  aadhaarNumber?: string;
  upiId?: string;
  salaryMonthly?: number;
  paidLeavesPerMonth?: number;
  isActive?: boolean;
  shiftStart?: string;
}

export interface EmployeeWithGeneratedPassword {
  employee: AdminEmployee;
  generatedPassword: string;
}

export interface PaginatedEmployees {
  employees: AdminEmployee[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListEmployeesParams {
  search?: string;
  page?: number;
  limit?: number;
}
