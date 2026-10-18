import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ClientHistory, ClientHistoryParams, ClientPayload, ClientRecord } from '../models/client.model';

// Deliberately always /admin/clients — managing the client database has no
// /team scope equivalent, it is the owner's alone. (The Assign Task dropdown
// reads the list through AdminTaskService.clients() instead.)
@Injectable({ providedIn: 'root' })
export class AdminClientService {
  private readonly base = `${environment.apiUrl}/admin/clients`;

  constructor(private http: HttpClient) {}

  list(): Promise<ClientRecord[]> {
    return firstValueFrom(this.http.get<{ clients: ClientRecord[] }>(this.base)).then(r => r.clients);
  }

  history(id: string, params: ClientHistoryParams = {}): Promise<ClientHistory> {
    const query: Record<string, string> = {};
    if (params.status) query['status'] = params.status;
    if (params.from) query['from'] = params.from;
    if (params.to) query['to'] = params.to;
    if (params.page) query['page'] = String(params.page);
    return firstValueFrom(this.http.get<ClientHistory>(`${this.base}/${id}/history`, { params: query }));
  }

  create(payload: ClientPayload): Promise<ClientRecord> {
    return firstValueFrom(this.http.post<{ client: ClientRecord }>(this.base, payload)).then(r => r.client);
  }

  update(id: string, payload: ClientPayload): Promise<ClientRecord> {
    return firstValueFrom(this.http.patch<{ client: ClientRecord }>(`${this.base}/${id}`, payload)).then(r => r.client);
  }

  remove(id: string): Promise<{ success: boolean; tasksUnlinked: number }> {
    return firstValueFrom(this.http.delete<{ success: boolean; tasksUnlinked: number }>(`${this.base}/${id}`));
  }
}
