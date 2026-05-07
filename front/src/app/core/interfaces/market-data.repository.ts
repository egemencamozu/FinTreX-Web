import { Observable } from 'rxjs';
import { MarketForexRate, MarketSnapshot, MarketStreamEvent } from '../models/market-data.model';

export abstract class MarketDataRepository {
  abstract getSnapshot(): Observable<MarketSnapshot>;
  abstract getUsdTryRate(): Observable<MarketForexRate>;
  abstract connect(): Observable<MarketStreamEvent>;
  abstract subscribeToStocks(tickers: string[]): Promise<void>;
  abstract subscribeToCryptos(symbols: string[]): Promise<void>;
  abstract disconnect(): Promise<void>;
}
