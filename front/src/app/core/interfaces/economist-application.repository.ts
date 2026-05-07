import { Observable } from 'rxjs';
import { EconomistStatus } from '../enums/economist-status.enum';
import {
  AdminReviewApplicationRequest,
  EconomistApplication,
  PagedEconomistApplicationsResult,
  SubmitEconomistApplicationRequest,
} from '../models/economist-application.model';

export abstract class EconomistApplicationRepository {
  abstract submit(request: SubmitEconomistApplicationRequest): Observable<EconomistApplication>;
  abstract getMyLatest(): Observable<EconomistApplication | null>;
  abstract adminList(
    status?: EconomistStatus,
    page?: number,
    pageSize?: number
  ): Observable<PagedEconomistApplicationsResult>;
  abstract adminGetDetail(id: number): Observable<EconomistApplication>;
  abstract adminReview(
    id: number,
    request: AdminReviewApplicationRequest
  ): Observable<EconomistApplication>;
}

