import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EconomistRepository } from '../../core/interfaces/economist.repository';
import { AvailableEconomist } from '../../core/models/available-economist.model';
import { EconomistClient } from '../../core/models/economist.model';
import { EconomistRating } from '../../core/models/economist-rating.model';
import { EnvironmentConfigService } from '../../core/services/environment-config.service';

@Injectable({
  providedIn: 'root'
})
export class EconomistApiRepository extends EconomistRepository {
  private readonly baseUrl: string;

  constructor(
    private http: HttpClient,
    private configService: EnvironmentConfigService
  ) {
    super();
    this.baseUrl = `${this.configService.get('apiBaseUrl')}/v1/EconomistClients`;
  }

  getMyClients(): Observable<EconomistClient[]> {
    return this.http.get<EconomistClient[]>(`${this.baseUrl}/clients`);
  }

  getMyEconomists(): Observable<EconomistClient[]> {
    return this.http.get<EconomistClient[]>(`${this.baseUrl}/my-economists`);
  }

  adminGetClientEconomists(clientId: string): Observable<EconomistClient[]> {
    return this.http.get<EconomistClient[]>(`${this.baseUrl}/admin/clients/${clientId}/economists`);
  }

  getAvailableEconomists(): Observable<AvailableEconomist[]> {
    return this.http.get<AvailableEconomist[]>(`${this.baseUrl}/economists`);
  }

  assignEconomist(economistId: string): Observable<EconomistClient> {
    return this.http.post<EconomistClient>(`${this.baseUrl}/assign?economistId=${economistId}`, {});
  }

  assignRandomEconomist(): Observable<EconomistClient> {
    return this.http.post<EconomistClient>(`${this.baseUrl}/assign-random`, {});
  }

  adminChangeAssignment(assignmentId: number, newEconomistId: string, notes?: string): Observable<EconomistClient> {
    return this.http.put<EconomistClient>(`${this.baseUrl}/admin/assignments/${assignmentId}/change`, {
      newEconomistId,
      notes,
    });
  }

  adminRemoveAssignment(assignmentId: number, notes?: string): Observable<EconomistClient> {
    return this.http.put<EconomistClient>(`${this.baseUrl}/admin/assignments/${assignmentId}/remove`, {
      notes,
    });
  }

  adminGetEconomistRatings(economistId: string): Observable<EconomistRating[]> {
    return this.http.get<EconomistRating[]>(`${this.baseUrl}/admin/economists/${economistId}/ratings`);
  }
}
