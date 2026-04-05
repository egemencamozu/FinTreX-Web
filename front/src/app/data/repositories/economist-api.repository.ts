import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EconomistRepository } from '../../core/interfaces/economist.repository';
import { AvailableEconomist } from '../../core/models/available-economist.model';
import { EconomistClient } from '../../core/models/economist.model';
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

  getAvailableEconomists(): Observable<AvailableEconomist[]> {
    return this.http.get<AvailableEconomist[]>(`${this.baseUrl}/economists`);
  }

  assignEconomist(economistId: string): Observable<EconomistClient> {
    return this.http.post<EconomistClient>(`${this.baseUrl}/assign?economistId=${economistId}`, {});
  }

  removeEconomist(assignmentId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${assignmentId}`);
  }
}
