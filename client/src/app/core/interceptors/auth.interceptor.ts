import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ADMIN_TOKEN_KEY } from '../services/admin-auth.service';

const EMPLOYEE_TOKEN_KEY = 'sundesh_token';

// These endpoints legitimately return 401 for reasons that have nothing to
// do with the current session (bad login credentials, wrong current
// password) — a 401 from them must never be treated as "log the user out."
const AUTH_ENDPOINTS_WITH_EXPECTED_401 = [
  `${environment.apiUrl}/auth/login`,
  `${environment.apiUrl}/auth/change-password`,
  `${environment.apiUrl}/admin/auth/login`,
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const isAdminRequest = req.url.startsWith(`${environment.apiUrl}/admin/`);
  const tokenKey = isAdminRequest ? ADMIN_TOKEN_KEY : EMPLOYEE_TOKEN_KEY;
  const token = localStorage.getItem(tokenKey);

  const authorized = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authorized).pipe(
    catchError(err => {
      const isExpectedAuthEndpoint = AUTH_ENDPOINTS_WITH_EXPECTED_401.some(url => req.url.startsWith(url));
      if (err.status === 401 && !isExpectedAuthEndpoint) {
        if (isAdminRequest) {
          localStorage.removeItem(ADMIN_TOKEN_KEY);
          localStorage.removeItem('sundesh_admin');
          router.navigate(['/superadmin']);
        } else {
          localStorage.removeItem(EMPLOYEE_TOKEN_KEY);
          localStorage.removeItem('sundesh_user');
          router.navigate(['/login']);
        }
      }
      return throwError(() => err);
    }),
  );
};
