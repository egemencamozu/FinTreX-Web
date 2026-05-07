import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { EconomistApplicationRepository } from '../../core/interfaces/economist-application.repository';
import { EconomistStatus } from '../../core/enums/economist-status.enum';
import {
  AdminReviewApplicationRequest,
  EconomistApplication,
  PagedEconomistApplicationsResult,
  SubmitEconomistApplicationRequest,
} from '../../core/models/economist-application.model';
import { EnvironmentConfigService } from '../../core/services/environment-config.service';

@Injectable({ providedIn: 'root' })
export class EconomistApplicationApiRepository extends EconomistApplicationRepository {
  private readonly baseUrl: string;
  private readonly adminBaseUrl: string;

  constructor(
    private http: HttpClient,
    private configService: EnvironmentConfigService
  ) {
    super();
    const api = this.configService.get('apiBaseUrl');
    this.baseUrl = `${api}/v1/economist-applications`;
    this.adminBaseUrl = `${api}/v1/admin/economist-applications`;
  }

  submit(request: SubmitEconomistApplicationRequest): Observable<EconomistApplication> {
    return this.http.post<EconomistApplication>(this.baseUrl, request).pipe(map(a => this.normalize(a)));
  }

  getMyLatest(): Observable<EconomistApplication | null> {
    return this.http.get<EconomistApplication>(`${this.baseUrl}/me`).pipe(
      map(a => this.normalize(a)),
      catchError(() => of(null))
    );
  }

  adminList(
    status?: EconomistStatus,
    page = 1,
    pageSize = 20
  ): Observable<PagedEconomistApplicationsResult> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<PagedEconomistApplicationsResult>(this.adminBaseUrl, { params }).pipe(
      map(result => ({
        ...result,
        items: result.items.map(a => this.normalize(a))
      }))
    );
  }

  adminGetDetail(id: number): Observable<EconomistApplication> {
    return this.http.get<EconomistApplication>(`${this.adminBaseUrl}/${id}`).pipe(map(a => this.normalize(a)));
  }

  adminReview(id: number, request: AdminReviewApplicationRequest): Observable<EconomistApplication> {
    return this.http.post<EconomistApplication>(`${this.adminBaseUrl}/${id}/review`, request).pipe(map(a => this.normalize(a)));
  }

  /** Ensure arrays and optional fields are never undefined/null. */
  private normalize(app: EconomistApplication): EconomistApplication {
    return {
      ...app,
      expertiseAreas: app.expertiseAreas ?? [],
      licensesAndCertificates: app.licensesAndCertificates ?? [],
      links: app.links ?? [],
    };
  }
}

