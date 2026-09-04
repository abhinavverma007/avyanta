import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateReimbursementPayload, Reimbursement } from '../models/reimbursement.model';

@Injectable({ providedIn: 'root' })
export class ReimbursementService {
  private readonly base = `${environment.apiUrl}/reimbursements`;

  constructor(private http: HttpClient) {}

  create(payload: CreateReimbursementPayload): Promise<Reimbursement> {
    return firstValueFrom(this.http.post<{ claim: Reimbursement }>(this.base, payload)).then(r => r.claim);
  }

  mine(): Promise<Reimbursement[]> {
    return firstValueFrom(this.http.get<{ claims: Reimbursement[] }>(`${this.base}/mine`)).then(r => r.claims);
  }
}
