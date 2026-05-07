export interface PortfolioHistory {
  interval: string;
  currency: 'TRY' | 'USD';
  startUtc: string;
  endUtc: string;
  labels: string[];
  values: number[];
}
