export type MarketConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

export interface MarketStockPrice {
  ticker: string;
  companyName: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  updatedAt: string;
}

export interface MarketCryptoPrice {
  symbol: string;
  baseAsset: string;
  priceUsdt: number;
  priceTry: number;
  changePercent1h: number | null;
  changePercent4h: number | null;
  changePercent24h: number;
  marketCapUsdt: number | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
  network: string | null;
  volume24h: number;
  trySource: string;
  updatedAt: string;
}

export interface MarketIndexPrice {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  updatedAt: string;
}

export interface MarketForexRate {
  pair: string;
  rate: number;
  source: string;
  quality: string;
  updatedAt: string;
}

export interface MarketGoldPrice {
  ounceUsd: number;
  ounceTry: number;
  gramUsd: number;
  gramTry: number;
  priceQuality: string;
  updatedAt: string;
}

export interface MarketGoldTypes {
  gramTry: number;
  ceyrekTry: number;
  yarimTry: number;
  tamTry: number;
  cumhuriyetTry: number;
  ataTry: number;
  updatedAt: string;
}

export interface MarketSnapshot {
  marketOpen: boolean;
  stocks: MarketStockPrice[];
  cryptos: MarketCryptoPrice[];
  indices: MarketIndexPrice[];
  usdTry: MarketForexRate | null;
  goldSpot: MarketGoldPrice | null;
  goldTypes: MarketGoldTypes | null;
}

export type MarketStreamEvent =
  | {
      type: 'connection';
      state: MarketConnectionState;
      errorMessage?: string;
    }
  | {
      type: 'stock';
      payload: MarketStockPrice;
    }
  | {
      type: 'crypto';
      payload: MarketCryptoPrice;
    }
  | {
      type: 'index';
      payload: MarketIndexPrice;
    }
  | {
      type: 'forex';
      payload: MarketForexRate;
    }
  | {
      type: 'gold';
      payload: MarketGoldPrice;
    };
