import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
  LogLevel,
} from '@microsoft/signalr';
import { forkJoin, Observable, of, Subject } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { MarketDataRepository } from '../../core/interfaces/market-data.repository';
import {
  MarketCryptoPrice,
  MarketForexRate,
  MarketGoldPrice,
  MarketGoldTypes,
  MarketIndexPrice,
  MarketSnapshot,
  MarketStockPrice,
  MarketStreamEvent,
} from '../../core/models/market-data.model';
import { EnvironmentConfigService } from '../../core/services/environment-config.service';

interface StocksBist30Response {
  marketOpen: boolean;
  items: MarketStockPrice[];
}

@Injectable({ providedIn: 'root' })
export class MarketDataApiRepository extends MarketDataRepository {
  private readonly isBrowser: boolean;
  private hubConnection: HubConnection | null = null;
  private readonly streamEvents = new Subject<MarketStreamEvent>();
  private readonly trackedStockTickers = new Set<string>();
  private readonly trackedCryptoSymbols = new Set<string>();
  private connectPromise: Promise<void> | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly envConfig: EnvironmentConfigService,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    super();
    this.isBrowser = isPlatformBrowser(platformId);
  }

  getSnapshot(): Observable<MarketSnapshot> {
    return forkJoin({
      bist30: this.http.get<StocksBist30Response>('/v1/stocks/bist').pipe(
        catchError(() =>
          of<StocksBist30Response>({
            marketOpen: false,
            items: [],
          }),
        ),
      ),
      cryptos: this.http
        .get<MarketCryptoPrice[]>('/v1/crypto/all')
        .pipe(catchError(() => of<MarketCryptoPrice[]>([]))),
      indices: this.http
        .get<MarketIndexPrice[]>('/v1/stocks/indices')
        .pipe(catchError(() => of<MarketIndexPrice[]>([]))),
      usdTry: this.http
        .get<MarketForexRate>('/v1/forex/usdtry')
        .pipe(catchError(() => of<MarketForexRate | null>(null))),
      goldSpot: this.http
        .get<MarketGoldPrice>('/v1/gold/spot')
        .pipe(catchError(() => of<MarketGoldPrice | null>(null))),
      goldTypes: this.http
        .get<MarketGoldTypes>('/v1/gold/types')
        .pipe(catchError(() => of<MarketGoldTypes | null>(null))),
    }).pipe(
      map(({ bist30, cryptos, indices, usdTry, goldSpot, goldTypes }) => ({
        marketOpen: bist30.marketOpen,
        stocks: [...bist30.items],
        cryptos: [...cryptos],
        indices: [...indices],
        usdTry,
        goldSpot,
        goldTypes,
      })),
    );
  }

  connect(): Observable<MarketStreamEvent> {
    if (!this.isBrowser) {
      return of<MarketStreamEvent>({
        type: 'connection',
        state: 'disconnected',
      });
    }

    if (this.hubConnection === null) {
      this.hubConnection = this.buildConnection();
      this.registerHandlers(this.hubConnection);
    }

    void this.ensureConnected();
    return this.streamEvents.asObservable();
  }

  async subscribeToStocks(tickers: string[]): Promise<void> {
    const normalized = this.normalizeTickers(tickers);
    for (const ticker of normalized) {
      this.trackedStockTickers.add(ticker);
    }

    if (normalized.length === 0) {
      return;
    }

    await this.ensureConnected();
    if (this.hubConnection?.state !== HubConnectionState.Connected) {
      return;
    }

    try {
      await this.hubConnection.invoke('SubscribeToStocks', normalized);
    } catch {
      this.streamEvents.next({
        type: 'connection',
        state: 'disconnected',
        errorMessage: 'Hisse abonelikleri kurulamadı.',
      });
    }
  }

  async subscribeToCryptos(symbols: string[]): Promise<void> {
    const normalized = this.normalizeTickers(symbols);
    for (const symbol of normalized) {
      this.trackedCryptoSymbols.add(symbol);
    }

    if (normalized.length === 0) {
      return;
    }

    await this.ensureConnected();
    if (this.hubConnection?.state !== HubConnectionState.Connected) {
      return;
    }

    try {
      const chunkSize = 200;
      for (let i = 0; i < normalized.length; i += chunkSize) {
        await this.hubConnection.invoke('SubscribeToCryptos', normalized.slice(i, i + chunkSize));
      }
    } catch {
      this.streamEvents.next({
        type: 'connection',
        state: 'disconnected',
        errorMessage: 'Kripto abonelikleri kurulamadı.',
      });
    }
  }

  async disconnect(): Promise<void> {
    if (this.hubConnection === null) {
      return;
    }

    const connection = this.hubConnection;
    this.hubConnection = null;
    this.connectPromise = null;

    try {
      await connection.stop();
    } catch {
      // ignore stop errors on route changes
    }

    this.streamEvents.next({
      type: 'connection',
      state: 'disconnected',
    });
  }

  private buildConnection(): HubConnection {
    return new HubConnectionBuilder()
      .withUrl(this.resolveHubUrl(), {
        accessTokenFactory: () => this.readAccessToken() ?? '',
        skipNegotiation: false,
        transport: HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(LogLevel.Warning)
      .build();
  }

  private registerHandlers(connection: HubConnection): void {
    connection.on('StockUpdated', (payload: unknown) => {
      const mapped = this.mapStock(payload);
      if (mapped !== null) {
        this.streamEvents.next({ type: 'stock', payload: mapped });
      }
    });

    connection.on('CryptoUpdated', (payload: unknown) => {
      const mapped = this.mapCrypto(payload);
      if (mapped !== null) {
        this.streamEvents.next({ type: 'crypto', payload: mapped });
      }
    });

    connection.on('IndexUpdated', (payload: unknown) => {
      const mapped = this.mapIndex(payload);
      if (mapped !== null) {
        this.streamEvents.next({ type: 'index', payload: mapped });
      }
    });

    connection.on('ForexUpdated', (payload: unknown) => {
      const mapped = this.mapForex(payload);
      if (mapped !== null) {
        this.streamEvents.next({ type: 'forex', payload: mapped });
      }
    });

    connection.on('GoldUpdated', (payload: unknown) => {
      const mapped = this.mapGold(payload);
      if (mapped !== null) {
        this.streamEvents.next({ type: 'gold', payload: mapped });
      }
    });

    connection.onreconnecting(() => {
      this.streamEvents.next({
        type: 'connection',
        state: 'reconnecting',
      });
    });

    connection.onreconnected(() => {
      this.streamEvents.next({
        type: 'connection',
        state: 'connected',
      });

      void this.resubscribeTrackedGroups();
    });

    connection.onclose(() => {
      this.streamEvents.next({
        type: 'connection',
        state: 'disconnected',
      });
    });
  }

  private async ensureConnected(): Promise<void> {
    if (!this.isBrowser || this.hubConnection === null) {
      return;
    }

    if (this.hubConnection.state === HubConnectionState.Connected) {
      return;
    }

    if (this.connectPromise !== null) {
      await this.connectPromise;
      return;
    }

    this.connectPromise = this.startConnection(this.hubConnection).finally(() => {
      this.connectPromise = null;
    });

    await this.connectPromise;
  }

  private async startConnection(connection: HubConnection): Promise<void> {
    this.streamEvents.next({
      type: 'connection',
      state: 'connecting',
    });

    try {
      await connection.start();
      this.streamEvents.next({
        type: 'connection',
        state: 'connected',
      });

      await this.resubscribeTrackedGroups();
    } catch {
      this.streamEvents.next({
        type: 'connection',
        state: 'disconnected',
        errorMessage: 'Canlı piyasa bağlantısı kurulamıyor.',
      });
    }
  }

  private async resubscribeTrackedGroups(): Promise<void> {
    if (this.hubConnection?.state !== HubConnectionState.Connected) {
      return;
    }

    const stockTickers = [...this.trackedStockTickers];
    if (stockTickers.length > 0) {
      await this.hubConnection.invoke('SubscribeToStocks', stockTickers);
    }

    const cryptoSymbols = [...this.trackedCryptoSymbols];
    const chunkSize = 200;
    for (let i = 0; i < cryptoSymbols.length; i += chunkSize) {
      await this.hubConnection.invoke('SubscribeToCryptos', cryptoSymbols.slice(i, i + chunkSize));
    }
  }

  private resolveHubUrl(): string {
    const apiBaseUrl = this.envConfig.get('apiBaseUrl').trim();
    if (!apiBaseUrl) {
      return '/hubs/market';
    }

    const trimmed = apiBaseUrl.replace(/\/+$/, '');
    const root = trimmed.replace(/\/api(?:\/v\d+)?$/i, '');
    if (!root) {
      return '/hubs/market';
    }

    return `${root}/hubs/market`;
  }

  private readAccessToken(): string | null {
    if (!this.isBrowser) {
      return null;
    }

    const tokenStorageKey = this.envConfig.get('jwtTokenStorageKey');

    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem(tokenStorageKey);
      if (token) {
        return token;
      }
    }

    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(tokenStorageKey);
    }

    return null;
  }

  private normalizeTickers(values: string[]): string[] {
    return values
      .map((value) => (value ?? '').trim().toUpperCase())
      .filter((value, index, source) => value.length > 0 && source.indexOf(value) === index);
  }

  private mapStock(payload: unknown): MarketStockPrice | null {
    const record = this.toRecord(payload);
    const ticker = this.readString(record, 'ticker', 'Ticker');
    if (!ticker) {
      return null;
    }

    return {
      ticker,
      companyName: this.readString(record, 'companyName', 'CompanyName'),
      sector: this.readString(record, 'sector', 'Sector'),
      price: this.readNumber(record, 'price', 'Price'),
      change: this.readNumber(record, 'change', 'Change'),
      changePercent: this.readNumber(record, 'changePercent', 'ChangePercent'),
      volume: this.readNumber(record, 'volume', 'Volume'),
      updatedAt: this.readDateString(record, 'updatedAt', 'UpdatedAt'),
    };
  }

  private mapCrypto(payload: unknown): MarketCryptoPrice | null {
    const record = this.toRecord(payload);
    const symbol = this.readString(record, 'symbol', 'Symbol');
    if (!symbol) {
      return null;
    }

    return {
      symbol,
      baseAsset: this.readString(record, 'baseAsset', 'BaseAsset'),
      priceUsdt: this.readNumber(record, 'priceUsdt', 'PriceUsdt'),
      priceTry: this.readNumber(record, 'priceTry', 'PriceTry'),
      changePercent1h: this.readNullableNumber(record, 'changePercent1h', 'ChangePercent1h'),
      changePercent4h: this.readNullableNumber(record, 'changePercent4h', 'ChangePercent4h'),
      changePercent24h: this.readNumber(record, 'changePercent24h', 'ChangePercent24h'),
      marketCapUsdt: this.readNullableNumber(record, 'marketCapUsdt', 'MarketCapUsdt'),
      circulatingSupply: this.readNullableNumber(record, 'circulatingSupply', 'CirculatingSupply'),
      totalSupply: this.readNullableNumber(record, 'totalSupply', 'TotalSupply'),
      network: this.readNullableString(record, 'network', 'Network'),
      volume24h: this.readNumber(record, 'volume24h', 'Volume24h'),
      trySource: this.readString(record, 'trySource', 'TrySource'),
      updatedAt: this.readDateString(record, 'updatedAt', 'UpdatedAt'),
    };
  }

  private mapIndex(payload: unknown): MarketIndexPrice | null {
    const record = this.toRecord(payload);
    const ticker = this.readString(record, 'ticker', 'Ticker');
    if (!ticker) {
      return null;
    }

    return {
      ticker,
      name: this.readString(record, 'name', 'Name'),
      price: this.readNumber(record, 'price', 'Price'),
      change: this.readNumber(record, 'change', 'Change'),
      changePercent: this.readNumber(record, 'changePercent', 'ChangePercent'),
      updatedAt: this.readDateString(record, 'updatedAt', 'UpdatedAt'),
    };
  }

  private mapForex(payload: unknown): MarketForexRate | null {
    const record = this.toRecord(payload);
    const pair = this.readString(record, 'pair', 'Pair');
    if (!pair) {
      return null;
    }

    return {
      pair,
      rate: this.readNumber(record, 'rate', 'Rate'),
      source: this.readString(record, 'source', 'Source'),
      quality: this.readString(record, 'quality', 'Quality'),
      updatedAt: this.readDateString(record, 'updatedAt', 'UpdatedAt'),
    };
  }

  private mapGold(payload: unknown): MarketGoldPrice | null {
    const record = this.toRecord(payload);
    const gramTry = this.readNumber(record, 'gramTry', 'GramTry');
    if (gramTry <= 0) {
      return null;
    }

    return {
      ounceUsd: this.readNumber(record, 'ounceUsd', 'OunceUsd'),
      ounceTry: this.readNumber(record, 'ounceTry', 'OunceTry'),
      gramUsd: this.readNumber(record, 'gramUsd', 'GramUsd'),
      gramTry,
      priceQuality: this.readString(record, 'priceQuality', 'PriceQuality'),
      updatedAt: this.readDateString(record, 'updatedAt', 'UpdatedAt'),
    };
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value !== null && typeof value === 'object') {
      return value as Record<string, unknown>;
    }

    return {};
  }

  private readString(record: Record<string, unknown>, ...keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }

    return '';
  }

  private readNullableString(record: Record<string, unknown>, ...keys: string[]): string | null {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }

    return null;
  }

  private readNumber(record: Record<string, unknown>, ...keys: string[]): number {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }

    return 0;
  }

  private readNullableNumber(record: Record<string, unknown>, ...keys: string[]): number | null {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }

    return null;
  }

  private readDateString(record: Record<string, unknown>, ...keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }

    return new Date().toISOString();
  }
}
