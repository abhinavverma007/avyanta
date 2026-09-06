import { InjectionToken } from '@angular/core';

export type ApiScope = 'admin' | 'team';

// Lets the same Admin*Service (and the same Superadmin*Component) be reused
// for both a true owner session (calling /api/admin/*) and a delegated
// Supervisor/Manager session (calling /api/team/*, permission-gated on the
// backend) without any component/service duplication. Both kinds of
// session now share the exact same /superadmin/* frontend routes — a
// per-route provider there picks 'admin' or 'team' based on which auth
// service actually has a live session (see app.routes.ts). The 'admin'
// default here only matters before that provider runs.
export const API_SCOPE = new InjectionToken<ApiScope>('API_SCOPE', {
  providedIn: 'root',
  factory: () => 'admin',
});
