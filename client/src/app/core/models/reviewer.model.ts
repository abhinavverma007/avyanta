// Who approved/rejected a request — the owner or a delegated Supervisor/Manager.
// Null/absent on requests reviewed before the server started recording it.
export interface ReviewedBy {
  id: string;
  name: string;
  actorType: 'admin' | 'employee';
}
