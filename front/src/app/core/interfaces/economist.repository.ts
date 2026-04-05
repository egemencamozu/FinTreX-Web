import { Observable } from 'rxjs';
import { AvailableEconomist } from '../models/available-economist.model';
import { EconomistClient } from '../models/economist.model';

export abstract class EconomistRepository {
  abstract getMyClients(): Observable<EconomistClient[]>;
  abstract getMyEconomists(): Observable<EconomistClient[]>;
  abstract getAvailableEconomists(): Observable<AvailableEconomist[]>;
  abstract assignEconomist(economistId: string): Observable<EconomistClient>;
  abstract removeEconomist(assignmentId: number): Observable<void>;
}
