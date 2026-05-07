import { PortfolioAsset } from './asset.model';

export interface Portfolio {
  id: number;
  name: string;
  description?: string;
  parentPortfolioId?: number;
  isHiddenFromEconomists: boolean;
  assets: PortfolioAsset[];
  subPortfolios: Portfolio[];
  totalValue: number;
  createdAtUtc: string;
}
