import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PortfolioRepository, CreatePortfolioAssetRequest, UpdatePortfolioAssetRequest } from '../../core/interfaces/portfolio.repository';
import { Portfolio } from '../../core/models/portfolio.model';
import { PortfolioAsset } from '../../core/models/asset.model';
import { PortfolioHistory } from '../../core/models/portfolio-history.model';
import { PortfolioOverview } from '../../core/models/portfolio-overview.model';
import { PortfolioTransaction } from '../../core/models/transaction.model';
import { EnvironmentConfigService } from '../../core/services/environment-config.service';

@Injectable({
  providedIn: 'root'
})
export class PortfolioApiRepository implements PortfolioRepository {
  private readonly baseUrl: string;

  constructor(
    private http: HttpClient,
    private configService: EnvironmentConfigService
  ) {
    this.baseUrl = `${this.configService.get('apiBaseUrl')}/v1/Portfolios`;
  }

  getMyPortfolios(): Observable<Portfolio[]> {
    return this.http.get<Portfolio[]>(this.baseUrl);
  }

  getPortfolioById(portfolioId: number): Observable<Portfolio> {
    return this.http.get<Portfolio>(`${this.baseUrl}/${portfolioId}`);
  }

  createPortfolio(request: { name: string; description?: string; parentPortfolioId?: number }): Observable<Portfolio> {
    return this.http.post<Portfolio>(this.baseUrl, request);
  }

  updatePortfolio(portfolioId: number, request: { name: string; description?: string }): Observable<Portfolio> {
    return this.http.put<Portfolio>(`${this.baseUrl}/${portfolioId}`, request);
  }

  deletePortfolio(portfolioId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${portfolioId}`);
  }

  addAsset(portfolioId: number, request: CreatePortfolioAssetRequest): Observable<PortfolioAsset> {
    return this.http.post<PortfolioAsset>(`${this.baseUrl}/${portfolioId}/assets`, request);
  }

  updateAsset(assetId: number, request: UpdatePortfolioAssetRequest): Observable<PortfolioAsset> {
    return this.http.put<PortfolioAsset>(`${this.baseUrl}/assets/${assetId}`, request);
  }

  deleteAsset(assetId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/assets/${assetId}`);
  }

  getPortfolioOverview(portfolioId: number, currency: 'TRY' | 'USD' = 'TRY'): Observable<PortfolioOverview> {
    return this.http.get<PortfolioOverview>(`${this.baseUrl}/${portfolioId}/overview`, {
      params: {
        currency,
      },
    });
  }

  getPortfolioHistory(portfolioId: number, interval: string, currency: 'TRY' | 'USD' = 'TRY'): Observable<PortfolioHistory> {
    return this.http.get<PortfolioHistory>(`${this.baseUrl}/${portfolioId}/history`, {
      params: {
        interval,
        currency,
      },
    });
  }

  getTransactions(portfolioId: number): Observable<PortfolioTransaction[]> {
    return this.http.get<PortfolioTransaction[]>(`${this.baseUrl}/${portfolioId}/transactions`);
  }

  deleteTransaction(transactionId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/transactions/${transactionId}`);
  }

  getClientPortfolios(clientId: string): Observable<Portfolio[]> {
    return this.http.get<Portfolio[]>(`${this.baseUrl}/client/${clientId}`);
  }

  setEconomistVisibility(portfolioId: number, isHidden: boolean): Observable<Portfolio> {
    return this.http.patch<Portfolio>(`${this.baseUrl}/${portfolioId}/economist-visibility`, {
      isHiddenFromEconomists: isHidden,
    });
  }
}
