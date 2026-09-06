import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ADMIN_TOKEN_KEY, AdminAuthService } from '../services/admin-auth.service';
import { AuthService } from '../services/auth.service';
import { NoticeService } from '../services/notice.service';

const EMPLOYEE_TOKEN_KEY = 'sundesh_token';

// These endpoints legitimately return 401 for reasons that have nothing to
// do with the current session (bad login credentials, wrong current
// password) — a 401 from them must never be treated as "log the user out."
const AUTH_ENDPOINTS_WITH_EXPECTED_401 = [
  `${environment.apiUrl}/auth/login`,
  `${environment.apiUrl}/auth/change-password`,
  `${environment.apiUrl}/admin/auth/login`,
  `${environment.apiUrl}/admin/auth/change-password`,
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const adminAuthService = inject(AdminAuthService);
  const noticeService = inject(NoticeService);
  const isAdminRequest = req.url.startsWith(`${environment.apiUrl}/admin/`);
  const isTeamRequest = req.url.startsWith(`${environment.apiUrl}/team/`);
  const tokenKey = isAdminRequest ? ADMIN_TOKEN_KEY : EMPLOYEE_TOKEN_KEY;
  const token = localStorage.getItem(tokenKey);

  const authorized = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authorized).pipe(
    catchError(err => {
      const isExpectedAuthEndpoint = AUTH_ENDPOINTS_WITH_EXPECTED_401.some(url => req.url.startsWith(url));
      if (err.status === 401 && !isExpectedAuthEndpoint) {
        // Go through the services' own clear methods, not raw localStorage
        // writes — otherwise their in-memory isAuthenticated()/user() signals
        // keep reporting the old (now-invalid) session until a full page
        // reload, which previously let a stale Admin session silently
        // outrank a freshly-logged-in Supervisor's API_SCOPE resolution.
        if (isAdminRequest) {
          adminAuthService.clearLocalSession();
          router.navigate(['/superadmin']);
        } else {
          authService.clearLocalSession();
          router.navigate(['/login']);
        }
      } else if (err.status === 403 && isTeamRequest) {
        // The owner can change a Role's permissions while an employee
        // holding that role is already logged in — the backend enforces the
        // change immediately (this 403 is exactly that), but the employee's
        // cached nav/route-guard state was built at login and won't know
        // about it on its own. Refresh it in the background, bounce them
        // somewhere they still have access, and tell them why.
        authService.refreshUser().catch(() => {});
        noticeService.show('Your access to this feature was updated by the owner.');
        router.navigate(['/dashboard']);
      }
      return throwError(() => err);
    }),
  );
};
