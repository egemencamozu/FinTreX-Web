import { Observable } from 'rxjs';
import { Portfolio } from '../models/portfolio.model';
import { PortfolioAsset } from '../models/asset.model';
import { PortfolioHistory } from '../models/portfolio-history.model';
import { PortfolioOverview } from '../models/portfolio-overview.model';
import { PortfolioTransaction } from '../models/transaction.model';

export abstract class PortfolioRepository {
  abstract getMyPortfolios(): Observable<Portfolio[]>;
  abstract getPortfolioById(portfolioId: number): Observable<Portfolio>;
  abstract createPortfolio(request: { name: string; description?: string; parentPortfolioId?: number }): Observable<Portfolio>;
  abstract updatePortfolio(portfolioId: number, request: { name: string; description?: string }): Observable<Portfolio>;
  abstract deletePortfolio(portfolioId: number): Observable<void>;

  abstract addAsset(portfolioId: number, request: CreatePortfolioAssetRequest): Observable<PortfolioAsset>;
  abstract updateAsset(assetId: number, request: UpdatePortfolioAssetRequest): Observable<PortfolioAsset>;
  abstract deleteAsset(assetId: number): Observable<void>;
  abstract getPortfolioOverview(portfolioId: number, currency?: 'TRY' | 'USD'): Observable<PortfolioOverview>;
  abstract getPortfolioHistory(portfolioId: number, interval: string, currency?: 'TRY' | 'USD'): Observable<PortfolioHistory>;

  abstract getTransactions(portfolioId: number): Observable<PortfolioTransaction[]>;
  abstract deleteTransaction(transactionId: number): Observable<void>;

  abstract getClientPortfolios(clientId: string): Observable<Portfolio[]>;
  abstract setEconomistVisibility(portfolioId: number, isHidden: boolean): Observable<Portfolio>;
}

export interface CreatePortfolioAssetRequest {
  symbol: string;
  assetName: string;
  assetType: string;
  quantity: number;
  averageCost: number;
  currency: string;
  acquiredAtUtc: string;
  notes?: string;
}

export interface UpdatePortfolioAssetRequest {
  quantity?: number;
  averageCost?: number;
  notes?: string;
}
