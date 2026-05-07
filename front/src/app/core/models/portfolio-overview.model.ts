import { AssetType } from '../enums/asset-type.enum';

export interface PortfolioOverview {
  portfolioId: number;
  currency: 'TRY' | 'USD';
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPercent: number;
  usdTryRate: number | null;
  generatedAtUtc: string;
  allocations: PortfolioOverviewAllocation[];
  assetPerformances: PortfolioOverviewAssetPerformance[];
}

export interface PortfolioOverviewAllocation {
  label: string;
  value: number;
  weightPercent: number;
}

export interface PortfolioOverviewAssetPerformance {
  symbol: string;
  assetType: AssetType;
  value: number;
  changePercent: number;
}
