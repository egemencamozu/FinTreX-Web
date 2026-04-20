import { Observable } from 'rxjs';
import { MarketSnapshot, MarketStreamEvent } from '../models/market-data.model';

export abstract class MarketDataRepository {
  abstract getSnapshot(): Observable<MarketSnapshot>;
  abstract connect(): Observable<MarketStreamEvent>;
  abstract subscribeToStocks(tickers: string[]): Promise<void>;
  abstract subscribeToCryptos(symbols: string[]): Promise<void>;
  abstract disconnect(): Promise<void>;
}
