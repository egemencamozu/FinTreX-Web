import { Injectable, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { EnvironmentConfigService } from './environment-config.service';
import { AuthService } from './auth.service';

export interface StockTick {
  ticker: string;
  companyName: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  updatedAt: string;
}

export interface CryptoTick {
  symbol: string;
  baseAsset: string;
  priceUsdt: number;
  priceTry: number;
  changePercent1h: number | null;
  changePercent24h: number;
  changePercent4h: number | null;
  volume24h: number;
  updatedAt: string;
}

export interface IndexTick {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  updatedAt: string;
}

export interface ForexTick {
  pair: string;
  rate: number;
  source: string;
  quality: string;
  updatedAt: string;
}

export interface GoldTick {
  ounceUsd: number;
  ounceTry: number;
  gramUsd: number;
  gramTry: number;
  priceQuality: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class MarketDataSignalRService {
  private hubConnection: signalR.HubConnection | null = null;
  private readonly subscribedStocks = new Set<string>();
  private readonly subscribedCryptos = new Set<string>();

  readonly isConnected = signal(false);

  readonly stockTick$ = new Subject<StockTick>();
  readonly cryptoTick$ = new Subject<CryptoTick>();
  readonly indexTick$ = new Subject<IndexTick>();
  readonly forexTick$ = new Subject<ForexTick>();
  readonly goldTick$ = new Subject<GoldTick>();

  constructor(
    private configService: EnvironmentConfigService,
    private authService: AuthService
  ) {}

  async connect(): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) return;

    const token = this.authService.getToken();
    if (!token) return;

    const apiBase = this.configService.get('apiBaseUrl');
    const hubUrl = apiBase.replace('/api', '') + '/hubs/market';

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, { accessTokenFactory: () => token })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.registerEventHandlers();
    this.registerLifecycleHandlers();

    try {
      await this.hubConnection.start();
      this.isConnected.set(true);
      await this.restoreSubscriptions();
    } catch (err) {
      console.error('[MarketDataSignalR] Connection failed:', err);
      this.isConnected.set(false);
    }
  }

  async disconnect(): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.stop();
      this.hubConnection = null;
      this.isConnected.set(false);
    }
  }

  async subscribeToStock(ticker: string): Promise<void> {
    if (ticker) this.subscribedStocks.add(ticker);
    if (this.hubConnection?.state !== signalR.HubConnectionState.Connected) return;
    try {
      await this.hubConnection.invoke('SubscribeToStock', ticker);
    } catch (err) {
      console.error(`[MarketDataSignalR] SubscribeToStock failed for ${ticker}:`, err);
    }
  }

  async subscribeToStocks(tickers: string[]): Promise<void> {
    if (!tickers.length) return;
    for (const ticker of tickers) {
      if (ticker) this.subscribedStocks.add(ticker);
    }
    if (this.hubConnection?.state !== signalR.HubConnectionState.Connected) return;
    try {
      await this.hubConnection.invoke('SubscribeToStocks', tickers);
    } catch (err) {
      console.error('[MarketDataSignalR] SubscribeToStocks failed:', err);
    }
  }

  async unsubscribeFromStock(ticker: string): Promise<void> {
    this.subscribedStocks.delete(ticker);
    if (this.hubConnection?.state !== signalR.HubConnectionState.Connected) return;
    try {
      await this.hubConnection.invoke('UnsubscribeFromStock', ticker);
    } catch (err) {
      console.error(`[MarketDataSignalR] UnsubscribeFromStock failed for ${ticker}:`, err);
    }
  }

  async subscribeToCrypto(symbol: string): Promise<void> {
    if (symbol) this.subscribedCryptos.add(symbol);
    if (this.hubConnection?.state !== signalR.HubConnectionState.Connected) return;
    try {
      await this.hubConnection.invoke('SubscribeToCrypto', symbol);
    } catch (err) {
      console.error(`[MarketDataSignalR] SubscribeToCrypto failed for ${symbol}:`, err);
    }
  }

  async subscribeToCryptos(symbols: string[]): Promise<void> {
    if (!symbols.length) return;
    for (const symbol of symbols) {
      if (symbol) this.subscribedCryptos.add(symbol);
    }
    if (this.hubConnection?.state !== signalR.HubConnectionState.Connected) return;
    try {
      await this.hubConnection.invoke('SubscribeToCryptos', symbols);
    } catch (err) {
      console.error('[MarketDataSignalR] SubscribeToCryptos failed:', err);
    }
  }

  async unsubscribeFromCrypto(symbol: string): Promise<void> {
    this.subscribedCryptos.delete(symbol);
    if (this.hubConnection?.state !== signalR.HubConnectionState.Connected) return;
    try {
      await this.hubConnection.invoke('UnsubscribeFromCrypto', symbol);
    } catch (err) {
      console.error(`[MarketDataSignalR] UnsubscribeFromCrypto failed for ${symbol}:`, err);
    }
  }

  private registerEventHandlers(): void {
    if (!this.hubConnection) return;

    this.hubConnection.on('StockUpdated', (tick: StockTick) => this.stockTick$.next(tick));
    this.hubConnection.on('CryptoUpdated', (tick: CryptoTick) => this.cryptoTick$.next(tick));
    this.hubConnection.on('IndexUpdated', (tick: IndexTick) => this.indexTick$.next(tick));
    this.hubConnection.on('ForexUpdated', (tick: ForexTick) => this.forexTick$.next(tick));
    this.hubConnection.on('GoldUpdated', (tick: GoldTick) => this.goldTick$.next(tick));
  }

  private registerLifecycleHandlers(): void {
    if (!this.hubConnection) return;

    this.hubConnection.onreconnecting(() => this.isConnected.set(false));
    this.hubConnection.onreconnected(() => {
      this.isConnected.set(true);
      void this.restoreSubscriptions();
    });
    this.hubConnection.onclose(() => this.isConnected.set(false));
  }

  private async restoreSubscriptions(): Promise<void> {
    if (this.hubConnection?.state !== signalR.HubConnectionState.Connected) return;

    const stocks = [...this.subscribedStocks];
    const cryptos = [...this.subscribedCryptos];

    if (stocks.length) {
      try {
        await this.hubConnection.invoke('SubscribeToStocks', stocks);
      } catch (err) {
        console.error('[MarketDataSignalR] Restore stock subscriptions failed:', err);
      }
    }

    if (cryptos.length) {
      try {
        await this.hubConnection.invoke('SubscribeToCryptos', cryptos);
      } catch (err) {
        console.error('[MarketDataSignalR] Restore crypto subscriptions failed:', err);
      }
    }
  }
}
