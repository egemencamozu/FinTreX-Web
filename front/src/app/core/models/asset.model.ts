export interface Asset {
  id: string;
  symbol: string;
  name: string;
  market: 'BIST' | 'CRYPTO' | 'PRECIOUS_METAL';
  quantity: number;
  currentPrice?: number;
}
