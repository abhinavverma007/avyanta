// Who approved/rejected a request — the owner or a delegated Supervisor/Manager.
// Null/absent on requests reviewed before the server started recording it.
export interface ReviewedBy {
  id: string;
  name: string;
  actorType: 'admin' | 'employee';
}

// Set only when the owner flipped a decision a delegated Supervisor/Manager
// made — records what that decision was (status/reviewedBy on the request
// itself now describe the owner's decision). Null/absent otherwise.
export interface ReviewOverride {
  at: string;
  previousStatus: 'approved' | 'rejected';
  previousReviewedBy: ReviewedBy | null;
}
