import { AssetType } from '../enums/asset-type.enum';

export interface PortfolioAsset {
  id: number;
  portfolioId: number;
  symbol: string;
  assetName: string;
  assetType: AssetType;
  quantity: number;
  averageCost: number;
  currency: string;
  currentValue?: number;
  currentValueUpdatedAtUtc?: string;
  acquiredAtUtc: string;
  notes?: string;
  createdAtUtc: string;
  updatedAtUtc?: string;
}
