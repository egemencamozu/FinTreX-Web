import { Observable } from 'rxjs';
import { AdminStats } from '../models/admin-stats.model';

export abstract class AdminStatsRepository {
  abstract getStats(): Observable<AdminStats>;
}
