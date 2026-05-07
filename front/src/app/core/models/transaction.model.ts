import { AssetType } from '../enums/asset-type.enum';

export type TransactionType = 'Buy' | 'Sell';

export interface PortfolioTransaction {
  id: number;
  portfolioId: number;
  symbol: string;
  assetName: string;
  assetType: AssetType;
  type: TransactionType;
  quantity: number;
  price: number;
  currency: string;
  fees?: number;
  notes?: string;
  executedAtUtc: string;
  createdAtUtc: string;
}
