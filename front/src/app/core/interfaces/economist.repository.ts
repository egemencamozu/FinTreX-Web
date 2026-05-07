import { Observable } from 'rxjs';
import { AvailableEconomist } from '../models/available-economist.model';
import { EconomistClient } from '../models/economist.model';
import { EconomistRating } from '../models/economist-rating.model';

export abstract class EconomistRepository {
  abstract getMyClients(): Observable<EconomistClient[]>;
  abstract getMyEconomists(): Observable<EconomistClient[]>;
  abstract adminGetClientEconomists(clientId: string): Observable<EconomistClient[]>;
  abstract getAvailableEconomists(): Observable<AvailableEconomist[]>;
  abstract assignEconomist(economistId: string): Observable<EconomistClient>;
  abstract assignRandomEconomist(): Observable<EconomistClient>;
  abstract adminChangeAssignment(assignmentId: number, newEconomistId: string, notes?: string): Observable<EconomistClient>;
  abstract adminRemoveAssignment(assignmentId: number, notes?: string): Observable<EconomistClient>;
  abstract adminGetEconomistRatings(economistId: string): Observable<EconomistRating[]>;
}
