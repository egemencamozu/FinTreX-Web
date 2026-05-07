import { Observable } from 'rxjs';
import {
  AdminDashboardSummary,
  AdminDashboardTrends,
  AdminDashboardStripeLive,
} from '../models/admin-revenue-dashboard.model';

export abstract class AdminRevenueDashboardRepository {
  abstract getSummary(): Observable<AdminDashboardSummary>;
  abstract getTrends(): Observable<AdminDashboardTrends>;
  abstract getStripeLive(): Observable<AdminDashboardStripeLive>;
}
