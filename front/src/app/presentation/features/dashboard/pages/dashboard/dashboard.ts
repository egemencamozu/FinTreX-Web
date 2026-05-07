import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  LineChartComponent,
  LineChartInput,
} from '../../../../shared/components/charts/line-chart/line-chart.component';
import {
  DoughnutChartComponent,
  DoughnutItem,
} from '../../../../shared/components/charts/doughnut-chart/doughnut-chart.component';
import {
  MoverListComponent,
  MoverListItem,
} from '../../../../shared/components/mover-list/mover-list.component';
import { SegmentedControlComponent } from '../../../../shared/components/segmented-control/segmented-control.component';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import {
  MarketTickerComponent,
  MarketTickerItem,
} from '../../../../shared/components/market-ticker/market-ticker.component';
import { MarketDataRepository } from '../../../../../core/interfaces/market-data.repository';
import { PortfolioRepository } from '../../../../../core/interfaces/portfolio.repository';
import { MarketDataSignalRService } from '../../../../../core/services/market-data-signalr.service';
import { AssetType } from '../../../../../core/enums/asset-type.enum';
import {
  MarketCryptoPrice,
  MarketIndexPrice,
  MarketSnapshot,
  MarketStockPrice,
} from '../../../../../core/models/market-data.model';
import { Portfolio } from '../../../../../core/models/portfolio.model';
import { PortfolioAsset } from '../../../../../core/models/asset.model';
import { PortfolioHistory } from '../../../../../core/models/portfolio-history.model';
import { PortfolioOverview } from '../../../../../core/models/portfolio-overview.model';
import { PortfolioTransaction } from '../../../../../core/models/transaction.model';
import { WatchlistApiService } from '../../../../../core/services/watchlist-api.service';
import { PriceAlertApiService } from '../../../../../core/services/price-alert-api.service';
import { AlertsSignalRService } from '../../../../../core/services/alerts-signalr.service';
import { PriceAlert } from '../../../../../core/models/price-alert.model';
import { ConsultancyTaskRepository } from '../../../../../core/interfaces/consultancy-task.repository';
import { SupportTicketRepository } from '../../../../../core/interfaces/support-ticket.repository';
import { ConsultancyTask } from '../../../../../core/models/task.model';
import { SupportTicket } from '../../../../../core/models/support-ticket.model';
import { ConsultancyTaskStatus } from '../../../../../core/enums/consultancy-task-status.enum';
import { SupportTicketStatus } from '../../../../../core/enums/support-ticket-status.enum';

type DashboardRange = '24h' | '7d' | '30d' | '90d' | 'all';
type AllocationView = 'class' | 'position';
type NotificationView = 'admin' | 'economist';
type SignalTone = 'good' | 'warn' | 'danger' | 'neutral';

interface AllocationRow {
  label: string;
  value: number;
  weightPercent: number;
  colorVar: string;
}

interface HoldingRow {
  symbol: string;
  name: string;
  assetType: AssetType;
  quantity: number;
  unitPrice: number;
  value: number;
  pnl: number;
  pnlPercent: number;
  currency: string;
}

interface MarketTickerRow {
  symbol: string;
  label: string;
  value: number;
  changePercent: number;
  currency: string;
}

type HeroMarketTile = MarketTickerItem & { symbol: string };

interface MoverRow {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  currency: string;
  category: 'bist' | 'crypto' | 'index';
}

interface DashboardSignal {
  icon: string;
  label: string;
  value: string;
  detail: string;
  tone: SignalTone;
}

interface EconomistNotification {
  id: number;
  title: string;
  economistName: string;
  status: string;
  date: string;
  tone: 'pending' | 'progress' | 'completed' | 'cancelled';
}

interface AdminNotification {
  id: number;
  title: string;
  detail: string;
  status: string;
  date: string;
  tone: 'pending' | 'progress' | 'completed' | 'cancelled';
}

interface DashboardErrorState {
  portfolios?: string;
  markets?: string;
  watchlists?: string;
  consultancy?: string;
  support?: string;
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') {
    return fallback;
  }

  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    KpiCardComponent,
    MarketTickerComponent,
    LineChartComponent,
    DoughnutChartComponent,
    MoverListComponent,
    SegmentedControlComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly portfolioRepo = inject(PortfolioRepository);
  private readonly marketRepo = inject(MarketDataRepository);
  private readonly marketSignalR = inject(MarketDataSignalRService);
  private readonly watchlistApi = inject(WatchlistApiService);
  private readonly priceAlertApi = inject(PriceAlertApiService);
  private readonly alertsSignalR = inject(AlertsSignalRService);
  private readonly consultancyTaskRepo = inject(ConsultancyTaskRepository);
  private readonly supportTicketRepo = inject(SupportTicketRepository);
  private readonly destroyRef = inject(DestroyRef);

  readonly portfolios = signal<Portfolio[]>([]);
  readonly overviews = signal<Map<number, PortfolioOverview>>(new Map());
  readonly history = signal<PortfolioHistory | null>(null);
  readonly transactions = signal<PortfolioTransaction[]>([]);
  readonly marketSnapshot = signal<MarketSnapshot | null>(null);
  readonly consultancyTasks = signal<ConsultancyTask[]>([]);
  readonly supportTickets = signal<SupportTicket[]>([]);
  readonly selectedPortfolioId = signal<number | null>(null);
  readonly activeRange = signal<DashboardRange>('30d');
  readonly allocationView = signal<AllocationView>('class');
  readonly notificationView = signal<NotificationView>('admin');
  readonly isLoading = signal(true);
  readonly isMarketLoading = signal(true);
  readonly isWatchlistLoading = signal(true);
  readonly errors = signal<DashboardErrorState>({});
  readonly lastRefresh = signal<Date | null>(null);

  readonly rangeOptions: { id: DashboardRange; label: string }[] = [
    { id: '24h', label: '24s' },
    { id: '7d', label: '7g' },
    { id: '30d', label: '30g' },
    { id: '90d', label: '90g' },
    { id: 'all', label: 'Tümü' },
  ];

  readonly dashboardRangeOptions = this.rangeOptions.map(option =>
    option.id === 'all' ? { ...option, label: 'Tümü' } : option,
  );

  readonly allocationViewOptions: { id: AllocationView; label: string }[] = [
    { id: 'class', label: 'Sınıf' },
    { id: 'position', label: 'Pozisyon' },
  ];

  readonly notificationViewOptions: { id: NotificationView; label: string }[] = [
    { id: 'admin', label: 'Admin' },
    { id: 'economist', label: 'Ekonomist' },
  ];

  readonly selectedPortfolio = computed(() => {
    const id = this.selectedPortfolioId();
    const list = this.portfolios();
    return list.find(portfolio => portfolio.id === id) ?? list[0] ?? null;
  });

  readonly selectedOverview = computed(() => {
    const portfolio = this.selectedPortfolio();
    return portfolio ? this.overviews().get(portfolio.id) ?? null : null;
  });

  readonly selectedPortfolioName = computed(() => this.selectedPortfolio()?.name ?? 'Portföy seçilmedi');

  readonly selectedPortfolioDisplayName = computed(() => this.selectedPortfolio()?.name ?? 'Portföy seçilmedi');
  readonly selectedPortfolioDisplayId = computed(() => this.selectedPortfolio()?.id ?? null);
  readonly allPortfolioAssets = computed<PortfolioAsset[]>(() =>
    this.portfolios().flatMap(portfolio => portfolio.assets ?? []),
  );

  readonly selectedPortfolioValue = computed(() =>
    this.selectedOverview()?.totalValue ?? this.selectedPortfolio()?.totalValue ?? 0,
  );

  readonly selectedPortfolioPnl = computed(() => this.selectedOverview()?.totalPnl ?? 0);
  readonly selectedPortfolioPnlPercent = computed(() => this.selectedOverview()?.totalPnlPercent ?? 0);

  readonly totalPortfolioValue = computed(() =>
    this.portfolios().reduce((sum, portfolio) => {
      const overview = this.overviews().get(portfolio.id);
      return sum + (overview?.totalValue ?? portfolio.totalValue ?? 0);
    }, 0),
  );

  readonly totalPortfolioCost = computed(() =>
    [...this.overviews().values()].reduce((sum, overview) => sum + overview.totalCost, 0),
  );

  readonly totalPnl = computed(() =>
    [...this.overviews().values()].reduce((sum, overview) => sum + overview.totalPnl, 0),
  );

  readonly totalPnlPercent = computed(() => {
    const cost = this.totalPortfolioCost();
    return cost > 0 ? (this.totalPnl() / cost) * 100 : 0;
  });

  readonly totalAssetCount = computed(() =>
    this.portfolios().reduce((sum, portfolio) => sum + (portfolio.assets?.length ?? 0), 0),
  );

  readonly allocationRows = computed<AllocationRow[]>(() =>
    this.buildAllocationFromAssets(this.allPortfolioAssets()),
  );

  readonly allocationTotalValue = computed(() =>
    this.allocationRows().reduce((sum, row) => sum + row.value, 0),
  );

  readonly allocationDisplayRows = computed<AllocationRow[]>(() => {
    if (this.allocationView() === 'class') {
      return this.allocationRows();
    }

    const rows = this.buildHoldingRowsFromAssets(this.allPortfolioAssets())
      .slice(0, 5)
      .map((holding, index) => ({
        label: holding.symbol,
        value: holding.value,
        weightPercent: 0,
        colorVar: this.getAllocationColor(holding.symbol, index),
      }));
    const total = rows.reduce((sum, row) => sum + row.value, 0);

    return rows.map(row => ({
      ...row,
      weightPercent: total > 0 ? (row.value / total) * 100 : 0,
    }));
  });

  readonly allocationDisplayTotalValue = computed(() =>
    this.allocationDisplayRows().reduce((sum, row) => sum + row.value, 0),
  );

  readonly allocationPanelTitle = computed(() =>
    this.allocationView() === 'position' ? 'Pozisyon dağılımı' : 'Varlık sınıfları',
  );

  readonly allocationEmptyMessage = computed(() =>
    this.allocationView() === 'position'
      ? 'Portföye varlık eklediğinde pozisyon ağırlıkları burada görünür.'
      : 'Portföye varlık eklediğinde sınıf kırılımı burada görünür.',
  );

  readonly allocationGradient = computed(() => {
    const rows = this.allocationRows().filter(row => row.weightPercent > 0);
    if (!rows.length) {
      return 'conic-gradient(var(--chart-neutral) 0deg 360deg)';
    }

    let angle = 0;
    const stops = rows.map(row => {
      const start = angle;
      angle += row.weightPercent * 3.6;
      return `var(${row.colorVar}) ${start}deg ${angle}deg`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  });

  readonly allHoldingRows = computed<HoldingRow[]>(() =>
    this.buildHoldingRowsFromAssets(this.allPortfolioAssets()),
  );

  readonly holdingRows = computed<HoldingRow[]>(() => this.allHoldingRows().slice(0, 6));

  readonly selectedHoldingsTotalValue = computed(() =>
    this.allHoldingRows().reduce((sum, holding) => sum + holding.value, 0),
  );

  readonly largestHolding = computed(() => this.allHoldingRows()[0] ?? null);
  readonly largestHoldingSymbol = computed(() => this.largestHolding()?.symbol ?? 'Bekleniyor');

  readonly largestHoldingWeight = computed(() => {
    const total = this.selectedHoldingsTotalValue();
    const largest = this.largestHolding();
    return total > 0 && largest ? (largest.value / total) * 100 : 0;
  });

  readonly topThreeWeight = computed(() => {
    const total = this.selectedHoldingsTotalValue();
    if (total <= 0) {
      return 0;
    }

    const topThreeValue = this.allHoldingRows()
      .slice(0, 3)
      .reduce((sum, holding) => sum + holding.value, 0);
    return (topThreeValue / total) * 100;
  });

  readonly topThreeHoldings = computed(() => {
    const total = this.selectedHoldingsTotalValue();
    if (total <= 0) {
      return [];
    }

    return this.allHoldingRows().slice(0, 3).map(holding => ({
      symbol: holding.symbol,
      weight: (holding.value / total) * 100,
    }));
  });

  readonly topThreeHoldingsLabel = computed(() => {
    const holdings = this.topThreeHoldings();
    if (holdings.length === 0) {
      return 'İlk 3 pozisyon: Veri yok';
    }
    const label = holdings.map(h => `${h.symbol} ${this.formatPercent(h.weight, false)}`).join(', ');
    return `İlk 3 pozisyon: ${label}`;
  });

  readonly bestHolding = computed(() => {
    const rows = this.allHoldingRows();
    return rows.length
      ? rows.reduce((best, holding) => (holding.pnlPercent > best.pnlPercent ? holding : best), rows[0])
      : null;
  });

  readonly worstHolding = computed(() => {
    const rows = this.allHoldingRows();
    return rows.length
      ? rows.reduce((worst, holding) => (holding.pnlPercent < worst.pnlPercent ? holding : worst), rows[0])
      : null;
  });

  readonly chartPolyline = computed(() => this.getChartPoints(this.history()?.values ?? [], 640, 210));
  readonly chartAreaPath = computed(() => this.getChartArea(this.history()?.values ?? [], 640, 210));
  readonly chartTrendUp = computed(() => {
    const values = this.history()?.values ?? [];
    return values.length < 2 || values[values.length - 1] >= values[0];
  });

  readonly chartChangePercent = computed(() => {
    const values = this.history()?.values ?? [];
    if (values.length < 2 || values[0] === 0) {
      return 0;
    }
    return ((values[values.length - 1] - values[0]) / values[0]) * 100;
  });

  readonly hasHistoryData = computed(() =>
    (this.history()?.values ?? []).some(value => Number.isFinite(value) && value > 0),
  );

  readonly lineChartData = computed<LineChartInput>(() => {
    const history = this.history();
    const values = history?.values ?? [];
    const isUp = values.length < 2 || values[values.length - 1] >= values[0];
    const color = cssVar(isUp ? '--chart-profit' : '--chart-loss', isUp ? '#16a34a' : '#dc2626');

    return {
      labels: history?.labels ?? [],
      series: [
        {
          name: 'Tüm Portföyler',
          data: values,
          color,
          areaColor: `${color}33`,
        },
      ],
    };
  });

  readonly doughnutItems = computed<DoughnutItem[]>(() =>
    this.allocationDisplayRows().map(row => ({
      label: row.label,
      value: row.value,
    })),
  );

  readonly marketTicker = computed<MarketTickerRow[]>(() => {
    const snapshot = this.marketSnapshot();
    if (!snapshot) {
      return [];
    }

    const indices = snapshot.indices.slice(0, 3).map(index => ({
      symbol: index.ticker,
      label: index.name,
      value: index.price,
      changePercent: index.changePercent,
      currency: '',
    }));

    const extras: MarketTickerRow[] = [];
    if (snapshot.usdTry) {
      extras.push({
        symbol: 'USDTRY',
        label: 'Dolar/TL',
        value: snapshot.usdTry.rate,
        changePercent: 0,
        currency: 'TRY',
      });
    }
    if (snapshot.goldSpot) {
      extras.push({
        symbol: 'XAU',
        label: 'Gram altın',
        value: snapshot.goldSpot.gramTry,
        changePercent: 0,
        currency: 'TRY',
      });
    }

    return [...indices, ...extras];
  });

  readonly marketPulseItems = computed(() => this.marketTicker().slice(0, 4));

  readonly topMarketTiles = computed<HeroMarketTile[]>(() => {
    const snapshot = this.marketSnapshot();
    if (!snapshot) {
      return [
        { label: 'BIST', symbol: 'XU100', value: 'Bekleniyor', changePercent: null, icon: 'fa-solid fa-chart-line' },
        { label: 'BTC', symbol: 'BTC', value: 'Bekleniyor', changePercent: null, icon: 'fa-brands fa-bitcoin' },
        { label: 'USD/TRY', symbol: 'USDTRY', value: 'Bekleniyor', changePercent: null, icon: 'fa-solid fa-money-bill-trend-up' },
        { label: 'Altın', symbol: 'XAU', value: 'Bekleniyor', changePercent: null, icon: 'fa-solid fa-coins' },
      ];
    }

    const bist =
      snapshot.indices.find(index =>
        index.ticker.toLocaleUpperCase('tr-TR').includes('XU100') ||
        index.name.toLocaleLowerCase('tr-TR').includes('bist 100'),
      ) ?? snapshot.indices[0];

    const btc =
      snapshot.cryptos.find(crypto =>
        crypto.baseAsset?.toLocaleUpperCase('tr-TR') === 'BTC' ||
        crypto.symbol.toLocaleUpperCase('tr-TR').startsWith('BTC'),
      ) ?? snapshot.cryptos[0];

    return [
      {
        label: 'BIST',
        symbol: bist?.ticker ?? 'XU100',
        value: bist ? this.formatNumber(bist.price, 2) : 'Bekleniyor',
        changePercent: bist?.changePercent ?? null,
        icon: 'fa-solid fa-chart-line',
      },
      {
        label: 'BTC',
        symbol: btc?.baseAsset || btc?.symbol || 'BTC',
        value: btc ? this.formatMoney(btc.priceUsdt, 'USD') : 'Bekleniyor',
        changePercent: btc?.changePercent24h ?? null,
        icon: 'fa-brands fa-bitcoin',
      },
      {
        label: 'USD/TRY',
        symbol: 'USDTRY',
        value: snapshot.usdTry ? `${this.formatNumber(snapshot.usdTry.rate, 4)} TRY` : 'Bekleniyor',
        changePercent: null,
        icon: 'fa-solid fa-money-bill-trend-up',
      },
      {
        label: 'Altın',
        symbol: 'Gram',
        value: snapshot.goldSpot ? this.formatMoney(snapshot.goldSpot.gramTry, 'TRY') : 'Bekleniyor',
        changePercent: null,
        icon: 'fa-solid fa-coins',
      },
    ];
  });

  readonly marketTickerItems = computed<HeroMarketTile[]>(() => {
    const snapshot = this.marketSnapshot();
    if (!snapshot) {
      return [
        { label: 'BIST', symbol: 'XU100', value: 'Bekleniyor', changePercent: null, icon: 'fa-solid fa-chart-line' },
        { label: 'BTC', symbol: 'BTC', value: 'Bekleniyor', changePercent: null, icon: 'fa-brands fa-bitcoin' },
        { label: 'ETH', symbol: 'ETH', value: 'Bekleniyor', changePercent: null, icon: 'fa-solid fa-diamond' },
        { label: 'USD/TRY', symbol: 'USDTRY', value: 'Bekleniyor', changePercent: null, icon: 'fa-solid fa-money-bill-trend-up' },
        { label: 'Altın', symbol: 'XAU', value: 'Bekleniyor', changePercent: null, icon: 'fa-solid fa-coins' },
      ];
    }

    const bist =
      snapshot.indices.find(index =>
        index.ticker.toLocaleUpperCase('tr-TR').includes('XU100') ||
        index.name.toLocaleLowerCase('tr-TR').includes('bist 100'),
      ) ?? snapshot.indices[0];
    const btc =
      snapshot.cryptos.find(crypto =>
        crypto.baseAsset?.toLocaleUpperCase('tr-TR') === 'BTC' ||
        crypto.symbol.toLocaleUpperCase('tr-TR').startsWith('BTC'),
      ) ?? snapshot.cryptos[0];
    const eth = snapshot.cryptos.find(crypto =>
      crypto.baseAsset?.toLocaleUpperCase('tr-TR') === 'ETH' ||
      crypto.symbol.toLocaleUpperCase('tr-TR').startsWith('ETH'),
    );

    const items: HeroMarketTile[] = [
      {
        label: 'BIST',
        symbol: bist?.ticker ?? 'XU100',
        value: bist ? this.formatNumber(bist.price, 2) : 'Bekleniyor',
        changePercent: bist?.changePercent ?? null,
        icon: 'fa-solid fa-chart-line',
      },
      {
        label: 'BTC',
        symbol: btc?.baseAsset || btc?.symbol || 'BTC',
        value: btc ? this.formatMoney(btc.priceUsdt, 'USD') : 'Bekleniyor',
        changePercent: btc?.changePercent24h ?? null,
        icon: 'fa-brands fa-bitcoin',
      },
      ...(eth
        ? [{
            label: 'ETH',
            symbol: eth.baseAsset || eth.symbol,
            value: this.formatMoney(eth.priceUsdt, 'USD'),
            changePercent: eth.changePercent24h,
            icon: 'fa-solid fa-diamond',
          }]
        : []),
      {
        label: 'USD/TRY',
        symbol: 'USDTRY',
        value: snapshot.usdTry ? `${this.formatNumber(snapshot.usdTry.rate, 4)} TRY` : 'Bekleniyor',
        changePercent: null,
        icon: 'fa-solid fa-money-bill-trend-up',
      },
      {
        label: 'Altın',
        symbol: 'Gram',
        value: snapshot.goldSpot ? this.formatMoney(snapshot.goldSpot.gramTry, 'TRY') : 'Bekleniyor',
        changePercent: null,
        icon: 'fa-solid fa-coins',
      },
      ...(snapshot.goldSpot
        ? [{
            label: 'ONS',
            symbol: 'XAUUSD',
            value: this.formatMoney(snapshot.goldSpot.ounceUsd, 'USD'),
            changePercent: null,
            icon: 'fa-solid fa-circle-dollar-to-slot',
          }]
        : []),
      ...snapshot.indices
        .filter(index => index.ticker !== bist?.ticker)
        .slice(0, 3)
        .map(index => ({
          label: index.ticker.replace('.IS', ''),
          symbol: index.ticker,
          value: this.formatNumber(index.price, 2),
          changePercent: index.changePercent,
          icon: 'fa-solid fa-chart-simple',
        })),
      ...snapshot.stocks
        .filter(stock => Number.isFinite(stock.changePercent))
        .sort((left, right) => Math.abs(right.changePercent) - Math.abs(left.changePercent))
        .slice(0, 4)
        .map(stock => ({
          label: stock.ticker.replace('.IS', ''),
          symbol: stock.ticker,
          value: this.formatMoney(stock.price, 'TRY'),
          changePercent: stock.changePercent,
          icon: 'fa-solid fa-building-columns',
        })),
      ...snapshot.cryptos
        .filter(crypto => crypto.symbol !== btc?.symbol && crypto.symbol !== eth?.symbol)
        .filter(crypto => Number.isFinite(crypto.changePercent24h))
        .slice(0, 3)
        .map(crypto => ({
          label: crypto.baseAsset || crypto.symbol.replace('USDT', ''),
          symbol: crypto.symbol,
          value: this.formatMoney(crypto.priceUsdt, 'USD'),
          changePercent: crypto.changePercent24h,
          icon: 'fa-solid fa-coins',
        })),
    ];

    return items.slice(0, 16);
  });

  readonly heroMarketTiles = computed<HeroMarketTile[]>(() => {
    const snapshot = this.marketSnapshot();
    if (!snapshot) {
      return [
        { label: 'BIST', symbol: 'XU100', value: 'Bekleniyor', changePercent: null, icon: 'fa-solid fa-chart-line' },
        { label: 'Kripto', symbol: 'BTC', value: 'Bekleniyor', changePercent: null, icon: 'fa-brands fa-bitcoin' },
        { label: 'Doviz', symbol: 'USDTRY', value: 'Bekleniyor', changePercent: null, icon: 'fa-solid fa-money-bill-trend-up' },
        { label: 'Altin', symbol: 'XAU', value: 'Bekleniyor', changePercent: null, icon: 'fa-solid fa-coins' },
      ];
    }

    const primaryIndex = snapshot.indices[0];
    const primaryCrypto = snapshot.cryptos[0];

    return [
      {
        label: 'BIST',
        symbol: primaryIndex?.ticker ?? 'XU100',
        value: primaryIndex ? this.formatNumber(primaryIndex.price, 2) : 'Bekleniyor',
        changePercent: primaryIndex?.changePercent ?? null,
        icon: 'fa-solid fa-chart-line',
      },
      {
        label: 'Kripto',
        symbol: primaryCrypto?.baseAsset || primaryCrypto?.symbol || 'BTC',
        value: primaryCrypto ? this.formatMoney(primaryCrypto.priceUsdt, 'USD') : 'Bekleniyor',
        changePercent: primaryCrypto?.changePercent24h ?? null,
        icon: 'fa-brands fa-bitcoin',
      },
      {
        label: 'Doviz',
        symbol: 'USDTRY',
        value: snapshot.usdTry ? this.formatMoney(snapshot.usdTry.rate, 'TRY') : 'Bekleniyor',
        changePercent: null,
        icon: 'fa-solid fa-money-bill-trend-up',
      },
      {
        label: 'Altin',
        symbol: 'Gram',
        value: snapshot.goldSpot ? this.formatMoney(snapshot.goldSpot.gramTry, 'TRY') : 'Bekleniyor',
        changePercent: null,
        icon: 'fa-solid fa-coins',
      },
    ];
  });

  readonly dashboardSignals = computed<DashboardSignal[]>(() => {
    const signals: DashboardSignal[] = [];
    const largest = this.largestHolding();
    const best = this.bestHolding();
    const worst = this.worstHolding();
    const snapshot = this.marketSnapshot();
    const largestWeight = this.largestHoldingWeight();

    if (largest) {
      signals.push({
        icon: largestWeight >= 50 ? 'fa-triangle-exclamation' : 'fa-shield-halved',
        label: largestWeight >= 50 ? 'Yoğunlaşma' : 'Denge',
        value: `${largest.symbol} ${this.formatPercent(largestWeight, false)}`,
        detail:
          largestWeight >= 50
            ? 'Tek varlık portföyde belirgin ağırlık taşıyor.'
            : 'En büyük pozisyon kontrollü aralıkta.',
        tone: largestWeight >= 50 ? 'warn' : 'good',
      });
    }

    if (best) {
      signals.push({
        icon: 'fa-arrow-trend-up',
        label: 'En güçlü katkı',
        value: `${best.symbol} ${this.formatPercent(best.pnlPercent)}`,
        detail: `${this.formatMoney(best.pnl, best.currency)} gerçekleşmemiş K/Z`,
        tone: best.pnlPercent >= 0 ? 'good' : 'neutral',
      });
    }

    if (worst && worst.symbol !== best?.symbol) {
      signals.push({
        icon: 'fa-arrow-trend-down',
        label: 'Baskı oluşturan',
        value: `${worst.symbol} ${this.formatPercent(worst.pnlPercent)}`,
        detail: `${this.formatMoney(worst.pnl, worst.currency)} gerçekleşmemiş K/Z`,
        tone: worst.pnlPercent < 0 ? 'danger' : 'neutral',
      });
    }

    signals.push({
      icon: snapshot?.marketOpen ? 'fa-signal' : 'fa-moon',
      label: 'Piyasa durumu',
      value: snapshot?.marketOpen ? 'Açık' : 'Kapalı',
      detail: this.lastRefresh() ? `Son yenileme ${this.formatDateTime(this.lastRefresh())}` : 'Veri bekleniyor',
      tone: snapshot?.marketOpen ? 'good' : 'neutral',
    });

    if (this.watchlistTotalItems() === 0) {
      signals.push({
        icon: 'fa-star',
        label: 'Watchlist',
        value: 'Boş',
        detail: 'Takip etmek istediğin sembolleri ekleyebilirsin.',
        tone: 'warn',
      });
    }

    return signals.slice(0, 4);
  });

  readonly marketMovers = computed<MoverRow[]>(() => {
    const snapshot = this.marketSnapshot();
    if (!snapshot) {
      return [];
    }

    const stocks = snapshot.stocks.map(stock => this.stockToMover(stock));
    const cryptos = snapshot.cryptos.slice(0, 30).map(crypto => this.cryptoToMover(crypto));
    const indices = snapshot.indices.map(index => this.indexToMover(index));
    return [...stocks, ...cryptos, ...indices]
      .filter(row => Number.isFinite(row.changePercent))
      .sort((left, right) => Math.abs(right.changePercent) - Math.abs(left.changePercent))
      .slice(0, 7);
  });

  readonly moverListItems = computed<MoverListItem[]>(() =>
    this.marketMovers().map(mover => ({
      avatarFallback: mover.symbol.charAt(0),
      avatarColor: this.getMoverColor(mover.category),
      label: mover.symbol,
      value: mover.currency
        ? this.formatMoney(mover.price, mover.currency)
        : this.formatNumber(mover.price, 2),
      change: mover.changePercent,
    })),
  );

  readonly watchlists = this.watchlistApi.watchlists;
  readonly priceAlerts = this.priceAlertApi.alerts;
  readonly alertSummary = this.priceAlertApi.summary;
  readonly watchlistTotalItems = computed(() =>
    this.watchlists().reduce((sum, watchlist) => sum + watchlist.itemCount, 0),
  );
  readonly primaryWatchlists = computed(() => this.watchlists().slice(0, 3));
  readonly watchlistBadgeOverflow = computed(() =>
    Math.max(this.watchlists().length - this.primaryWatchlists().length, 0),
  );
  readonly portfolioBadges = computed(() => this.portfolios().slice(0, 3));
  readonly portfolioBadgeOverflow = computed(() =>
    Math.max(this.portfolios().length - this.portfolioBadges().length, 0),
  );
  readonly dashboardAlerts = computed<PriceAlert[]>(() => {
    const priority: Record<PriceAlert['status'], number> = {
      TRIGGERED: 0,
      ACTIVE: 1,
      PAUSED: 2,
      EXPIRED: 3,
    };

    return [...this.priceAlerts()]
      .sort((left, right) => {
        const statusDelta = priority[left.status] - priority[right.status];
        if (statusDelta !== 0) {
          return statusDelta;
        }
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      })
      .slice(0, 3);
  });
  readonly dashboardAlertOverflow = computed(() =>
    Math.max(this.priceAlerts().length - this.dashboardAlerts().length, 0),
  );
  readonly economistNotifications = computed<EconomistNotification[]>(() =>
    [...this.consultancyTasks()]
      .sort((left, right) => {
        const rightDate = new Date(right.completedAtUtc ?? right.createdAtUtc).getTime();
        const leftDate = new Date(left.completedAtUtc ?? left.createdAtUtc).getTime();
        return rightDate - leftDate;
      })
      .slice(0, 4)
      .map(task => ({
        id: task.id,
        title: task.title,
        economistName: task.economistName || 'Ekonomist',
        status: this.getConsultancyStatusLabel(task.status),
        date: this.formatDateTime(task.completedAtUtc ?? task.createdAtUtc),
        tone: this.getConsultancyStatusTone(task.status),
      })),
  );

  readonly adminNotifications = computed<AdminNotification[]>(() =>
    [...this.supportTickets()]
      .filter(ticket => ticket.respondedAtUtc || ticket.status !== SupportTicketStatus.Open)
      .sort((left, right) => {
        const rightDate = new Date(right.respondedAtUtc ?? right.createdAtUtc).getTime();
        const leftDate = new Date(left.respondedAtUtc ?? left.createdAtUtc).getTime();
        return rightDate - leftDate;
      })
      .slice(0, 4)
      .map(ticket => ({
        id: ticket.id,
        title: ticket.subject,
        detail: 'Admin talebinizin durumunu güncelledi.',
        status: this.getSupportStatusLabel(ticket.status),
        date: this.formatDateTime(ticket.respondedAtUtc ?? ticket.createdAtUtc),
        tone: this.getSupportStatusTone(ticket.status),
      })),
  );

  readonly latestTransactions = computed(() =>
    [...this.transactions()]
      .sort(
        (left, right) =>
          new Date(right.executedAtUtc).getTime() - new Date(left.executedAtUtc).getTime(),
      )
      .slice(0, 5),
  );

  ngOnInit(): void {
    this.reload();
    this.bindRealtimeNotifications();
    this.bindMarketDataNotifications();
  }

  reload(): void {
    this.lastRefresh.set(new Date());
    this.loadPortfolios();
    this.loadMarkets();
    void this.loadWatchlists();
    void this.loadAlerts();
    this.loadConsultancyTasks();
    this.loadSupportTickets();
  }

  selectPortfolio(portfolioId: number): void {
    if (this.selectedPortfolioId() === portfolioId) {
      return;
    }
    this.selectedPortfolioId.set(portfolioId);
    this.loadDashboardDetails();
  }

  setRange(range: DashboardRange): void {
    if (this.activeRange() === range) {
      return;
    }
    this.activeRange.set(range);
    this.loadDashboardDetails();
  }

  setAllocationView(view: AllocationView): void {
    this.allocationView.set(view);
  }

  setNotificationView(view: NotificationView): void {
    this.notificationView.set(view);
  }

  getAssetTypeLabel(assetType: AssetType): string {
    switch (assetType) {
      case AssetType.BIST:
        return 'BIST';
      case AssetType.Crypto:
        return 'Kripto';
      case AssetType.PreciousMetal:
        return 'Değerli maden';
      default:
        return 'Varlık';
    }
  }

  getAssetTypeClass(assetType: AssetType): string {
    switch (assetType) {
      case AssetType.BIST:
        return 'bist';
      case AssetType.Crypto:
        return 'crypto';
      case AssetType.PreciousMetal:
        return 'metal';
      default:
        return 'neutral';
    }
  }

  isCryptoAsset(assetType: AssetType): boolean {
    return assetType === AssetType.Crypto;
  }

  isGoldAsset(assetType: AssetType): boolean {
    return assetType === AssetType.PreciousMetal;
  }

  formatMoney(value: number, currency = 'TRY'): string {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'TRY' ? 0 : 2,
    }).format(value);
  }

  formatCompact(value: number, currency = 'TRY'): string {
    const formatted = new Intl.NumberFormat('tr-TR', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
    return currency ? `${formatted} ${currency}` : formatted;
  }

  formatPercent(value: number, signed = true): string {
    const prefix = signed && value > 0 ? '+' : '';
    return `${prefix}${value.toFixed(2)}%`;
  }

  formatNumber(value: number, maxDigits = 2): string {
    return new Intl.NumberFormat('tr-TR', {
      maximumFractionDigits: maxDigits,
    }).format(value);
  }

  formatDateTime(value: string | Date | null): string {
    if (!value) {
      return 'Bekleniyor';
    }
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  alertTargetLabel(alert: PriceAlert): string {
    if (alert.kind === 'PRICE') {
      return `${alert.direction === 'ABOVE' ? 'Ustu' : 'Alti'} ${this.formatMoney(alert.targetValue, alert.currency)}`;
    }

    return `${alert.direction === 'ABOVE' ? '+' : '-'}${alert.targetValue.toFixed(2)}%`;
  }

  alertStatusLabel(alert: PriceAlert): string {
    switch (alert.status) {
      case 'ACTIVE':
        return 'Aktif';
      case 'TRIGGERED':
        return 'Tetiklendi';
      case 'PAUSED':
        return 'Duraklatildi';
      case 'EXPIRED':
        return 'Suresi doldu';
      default:
        return alert.status;
    }
  }

  alertStatusTone(alert: PriceAlert): string {
    switch (alert.status) {
      case 'ACTIVE':
        return 'active';
      case 'TRIGGERED':
        return 'triggered';
      case 'PAUSED':
        return 'paused';
      default:
        return 'expired';
    }
  }

  private getConsultancyStatusLabel(status: ConsultancyTaskStatus): string {
    switch (status) {
      case ConsultancyTaskStatus.Pending:
        return 'Bekliyor';
      case ConsultancyTaskStatus.InProgress:
        return 'İşleniyor';
      case ConsultancyTaskStatus.Completed:
        return 'Tamamlandı';
      case ConsultancyTaskStatus.Cancelled:
        return 'İptal';
      default:
        return status;
    }
  }

  private getConsultancyStatusTone(status: ConsultancyTaskStatus): EconomistNotification['tone'] {
    switch (status) {
      case ConsultancyTaskStatus.Pending:
        return 'pending';
      case ConsultancyTaskStatus.InProgress:
        return 'progress';
      case ConsultancyTaskStatus.Completed:
        return 'completed';
      case ConsultancyTaskStatus.Cancelled:
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  private getSupportStatusLabel(status: SupportTicketStatus): string {
    switch (status) {
      case SupportTicketStatus.Open:
        return 'Açık';
      case SupportTicketStatus.InReview:
        return 'İnceleniyor';
      case SupportTicketStatus.Resolved:
        return 'Yanıtlandı';
      case SupportTicketStatus.Closed:
        return 'Kapalı';
      default:
        return status;
    }
  }

  private getSupportStatusTone(status: SupportTicketStatus): AdminNotification['tone'] {
    switch (status) {
      case SupportTicketStatus.Open:
        return 'pending';
      case SupportTicketStatus.InReview:
        return 'progress';
      case SupportTicketStatus.Resolved:
        return 'completed';
      case SupportTicketStatus.Closed:
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  transactionTotal(transaction: PortfolioTransaction): number {
    return transaction.quantity * transaction.price + (transaction.fees ?? 0);
  }

  private loadPortfolios(): void {
    this.isLoading.set(true);
    this.setError('portfolios', undefined);

    this.portfolioRepo
      .getMyPortfolios()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: portfolios => {
          this.portfolios.set(portfolios);
          this.loadOverviews(portfolios);
          this.loadDashboardDetails(portfolios);
          
          const stockTickers = new Set<string>();
          const cryptoSymbols = new Set<string>();
          for (const p of portfolios) {
            for (const a of p.assets || []) {
              if (a.assetType === AssetType.BIST) stockTickers.add(a.symbol);
              if (a.assetType === AssetType.Crypto) cryptoSymbols.add(a.symbol.endsWith('USDT') ? a.symbol : a.symbol + 'USDT');
            }
          }
          if (stockTickers.size) void this.marketSignalR.subscribeToStocks([...stockTickers]);
          if (cryptoSymbols.size) void this.marketSignalR.subscribeToCryptos([...cryptoSymbols]);
        },
        error: () => {
          this.isLoading.set(false);
          this.setError('portfolios', 'Portföy verileri yüklenemedi.');
        },
      });
  }

  private loadOverviews(portfolios: Portfolio[]): void {
    if (!portfolios.length) {
      this.overviews.set(new Map());
      this.isLoading.set(false);
      return;
    }

    forkJoin(portfolios.map(portfolio => this.portfolioRepo.getPortfolioOverview(portfolio.id, 'TRY')))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: overviews => {
          this.overviews.set(new Map(overviews.map(overview => [overview.portfolioId, overview])));
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.setError('portfolios', 'Portföy özetleri yüklenemedi.');
        },
      });
  }

  private loadDashboardDetails(portfolios = this.portfolios()): void {
    if (!portfolios.length) {
      this.history.set(null);
      this.transactions.set([]);
      return;
    }

    forkJoin({
      histories: forkJoin(
        portfolios.map(portfolio =>
          this.portfolioRepo.getPortfolioHistory(portfolio.id, this.activeRange(), 'TRY'),
        ),
      ),
      transactions: forkJoin(
        portfolios.map(portfolio => this.portfolioRepo.getTransactions(portfolio.id)),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ histories, transactions }) => {
          this.history.set(this.combineHistories(histories));
          this.transactions.set(transactions.flat());
        },
        error: () => {
          this.history.set(null);
          this.transactions.set([]);
          this.setError('portfolios', 'Portföy detayları yüklenemedi.');
        },
      });
  }

  private loadMarkets(): void {
    this.isMarketLoading.set(true);
    this.setError('markets', undefined);

    this.marketRepo
      .getSnapshot()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: snapshot => {
          this.marketSnapshot.set(snapshot);
          this.isMarketLoading.set(false);
          
          const stockTickers = snapshot.stocks.map(s => s.ticker);
          const cryptoSymbols = snapshot.cryptos.map(c => c.symbol);
          if (stockTickers.length) void this.marketSignalR.subscribeToStocks(stockTickers);
          if (cryptoSymbols.length) void this.marketSignalR.subscribeToCryptos(cryptoSymbols);
        },
        error: () => {
          this.isMarketLoading.set(false);
          this.setError('markets', 'Piyasa verileri yüklenemedi.');
        },
      });
  }

  private async loadWatchlists(): Promise<void> {
    this.isWatchlistLoading.set(true);
    this.setError('watchlists', undefined);
    try {
      await this.watchlistApi.reload();
    } catch {
      this.setError('watchlists', 'İzleme listeleri yüklenemedi.');
    } finally {
      this.isWatchlistLoading.set(false);
    }
  }

  private async loadAlerts(): Promise<void> {
    try {
      await this.priceAlertApi.reload();
      void this.alertsSignalR.connect();
    } catch {
      this.setError('watchlists', 'Alarmlar yuklenemedi.');
    }
  }

  private loadConsultancyTasks(): void {
    this.setError('consultancy', undefined);
    this.consultancyTaskRepo
      .getMyTasks()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: tasks => this.consultancyTasks.set(tasks),
        error: () => {
          this.consultancyTasks.set([]);
          this.setError('consultancy', 'Ekonomist bildirimleri yüklenemedi.');
        },
      });
  }

  private loadSupportTickets(): void {
    this.setError('support', undefined);
    this.supportTicketRepo
      .getMyTickets()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: tickets => this.supportTickets.set(tickets),
        error: () => {
          this.supportTickets.set([]);
          this.setError('support', 'Admin bildirimleri yüklenemedi.');
        },
      });
  }

  private bindRealtimeNotifications(): void {
    void this.alertsSignalR.connect();

    this.alertsSignalR.supportTicketUpdated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => this.refreshSupportTicket(event.ticketId));

    this.alertsSignalR.taskCompleted$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => this.refreshConsultancyTask(event.taskId));

    this.alertsSignalR.taskStatusChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => this.refreshConsultancyTask(event.taskId));
  }

  private bindMarketDataNotifications(): void {
    void this.marketSignalR.connect();

    this.marketSignalR.stockTick$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(tick => {
        this.marketSnapshot.update(snapshot => {
          if (!snapshot) return snapshot;
          const stocks = [...snapshot.stocks];
          const index = stocks.findIndex(s => s.ticker === tick.ticker);
          if (index >= 0) stocks[index] = { ...stocks[index], ...tick };
          return { ...snapshot, stocks };
        });
        this.updatePortfolioAssetPrices(tick.ticker, tick.price);
      });

    this.marketSignalR.cryptoTick$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(tick => {
        this.marketSnapshot.update(snapshot => {
          if (!snapshot) return snapshot;
          const cryptos = [...snapshot.cryptos];
          const index = cryptos.findIndex(c => c.symbol === tick.symbol);
          if (index >= 0) cryptos[index] = { ...cryptos[index], ...tick };
          return { ...snapshot, cryptos };
        });
        const symbolWithoutUSDT = tick.symbol.endsWith('USDT') ? tick.symbol.replace('USDT', '') : tick.symbol;
        this.updatePortfolioAssetPrices(tick.symbol, tick.priceUsdt);
        if (symbolWithoutUSDT !== tick.symbol) {
            this.updatePortfolioAssetPrices(symbolWithoutUSDT, tick.priceUsdt);
        }
      });

    this.marketSignalR.indexTick$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(tick => {
        this.marketSnapshot.update(snapshot => {
          if (!snapshot) return snapshot;
          const indices = [...snapshot.indices];
          const index = indices.findIndex(i => i.ticker === tick.ticker);
          if (index >= 0) indices[index] = { ...indices[index], ...tick };
          return { ...snapshot, indices };
        });
        this.updatePortfolioAssetPrices(tick.ticker, tick.price);
      });

    this.marketSignalR.forexTick$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(tick => {
        this.marketSnapshot.update(snapshot => {
          if (!snapshot) return snapshot;
          if (snapshot.usdTry && snapshot.usdTry.pair === tick.pair) {
            return { ...snapshot, usdTry: { ...snapshot.usdTry, ...tick } };
          }
          return snapshot;
        });
      });

    this.marketSignalR.goldTick$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(tick => {
        this.marketSnapshot.update(snapshot => {
          if (!snapshot) return snapshot;
          if (snapshot.goldSpot) {
            return { ...snapshot, goldSpot: { ...snapshot.goldSpot, ...tick } };
          }
          return snapshot;
        });
      });
  }

  private updatePortfolioAssetPrices(symbol: string, newPrice: number): void {
    this.portfolios.update(currentPortfolios => {
      let changed = false;
      const next = currentPortfolios.map(p => {
        if (!p.assets) return p;
        let assetChanged = false;
        const newAssets = p.assets.map(a => {
          if (a.symbol === symbol) {
            assetChanged = true;
            return { ...a, currentValue: newPrice };
          }
          return a;
        });
        if (assetChanged) {
          changed = true;
          return { ...p, assets: newAssets };
        }
        return p;
      });
      return changed ? next : currentPortfolios;
    });
    
    this.recalculateOverviewsLocally();
  }

  private recalculateOverviewsLocally(): void {
    const usdTryRate = this.marketSnapshot()?.usdTry?.rate ?? [...this.overviews().values()][0]?.usdTryRate ?? 32.5;

    this.overviews.update(current => {
      const next = new Map(current);
      for (const p of this.portfolios()) {
        const oldOverview = next.get(p.id);
        if (!oldOverview) continue;

        let totalValue = 0;
        let totalCost = 0;
        
        for (const asset of (p.assets || [])) {
          const rawPrice = asset.currentValue ?? asset.averageCost;
          const rawValue = asset.quantity * rawPrice;
          const rawCost = asset.quantity * asset.averageCost;

          const convertedValue = this.convertCurrency(rawValue, asset.currency, oldOverview.currency, usdTryRate);
          const convertedCost = this.convertCurrency(rawCost, asset.currency, oldOverview.currency, usdTryRate);

          totalValue += convertedValue;
          totalCost += convertedCost;
        }

        const totalPnl = totalValue - totalCost;
        const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

        next.set(p.id, {
          ...oldOverview,
          totalValue,
          totalCost,
          totalPnl,
          totalPnlPercent,
          usdTryRate
        });
      }
      return next;
    });
  }

  private convertCurrency(amount: number, from: string, to: string, usdTryRate: number): number {
    from = from.toUpperCase();
    to = to.toUpperCase();
    if (from === to) return amount;
    if (from === 'USD' && to === 'TRY') return amount * usdTryRate;
    if (from === 'TRY' && to === 'USD') return amount / usdTryRate;
    return amount;
  }

  private refreshSupportTicket(ticketId: number): void {
    this.supportTicketRepo
      .getTicketById(ticketId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ticket => this.upsertSupportTicket(ticket),
        error: () => this.loadSupportTickets(),
      });
  }

  private upsertSupportTicket(updated: SupportTicket): void {
    this.supportTickets.update(tickets => {
      const exists = tickets.some(ticket => ticket.id === updated.id);
      const next = exists
        ? tickets.map(ticket => ticket.id === updated.id ? updated : ticket)
        : [updated, ...tickets];
      return next.sort((a, b) =>
        new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime()
      );
    });
  }

  private refreshConsultancyTask(taskId: number): void {
    this.consultancyTaskRepo
      .getTaskById(taskId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: task => this.upsertConsultancyTask(task),
        error: () => this.loadConsultancyTasks(),
      });
  }

  private upsertConsultancyTask(updated: ConsultancyTask): void {
    this.consultancyTasks.update(tasks => {
      const exists = tasks.some(task => task.id === updated.id);
      const next = exists
        ? tasks.map(task => task.id === updated.id ? { ...task, ...updated } : task)
        : [updated, ...tasks];
      return next.sort((a, b) =>
        new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime()
      );
    });
  }

  private setError(key: keyof DashboardErrorState, message: string | undefined): void {
    this.errors.update(current => {
      const next = { ...current };
      if (message) {
        next[key] = message;
      } else {
        delete next[key];
      }
      return next;
    });
  }

  private combineHistories(histories: PortfolioHistory[]): PortfolioHistory | null {
    const nonEmpty = histories.filter(history => history.values.length > 0);
    if (!nonEmpty.length) {
      return null;
    }

    const primary = nonEmpty.reduce((best, current) =>
      current.labels.length > best.labels.length ? current : best,
    );
    const labels = primary.labels;
    const values = labels.map(label =>
      nonEmpty.reduce((sum, history) => {
        const index = history.labels.indexOf(label);
        return sum + (index >= 0 ? history.values[index] ?? 0 : 0);
      }, 0),
    );

    return {
      interval: this.activeRange(),
      currency: 'TRY',
      startUtc: primary.startUtc,
      endUtc: primary.endUtc,
      labels,
      values,
    };
  }

  private buildAllocationFromAssets(assets: PortfolioAsset[]): AllocationRow[] {
    const total = assets.reduce((sum, asset) => sum + this.getAssetValue(asset), 0);
    const grouped = new Map<string, number>();

    for (const asset of assets) {
      const label = this.getAssetTypeLabel(asset.assetType);
      grouped.set(label, (grouped.get(label) ?? 0) + this.getAssetValue(asset));
    }

    return [...grouped.entries()].map(([label, value]) => ({
      label,
      value,
      weightPercent: total > 0 ? (value / total) * 100 : 0,
      colorVar: '--chart-neutral',
    }));
  }

  private buildHoldingRowsFromAssets(assets: PortfolioAsset[]): HoldingRow[] {
    const grouped = new Map<
      string,
      {
        symbol: string;
        name: string;
        assetType: AssetType;
        quantity: number;
        value: number;
        cost: number;
        currency: string;
      }
    >();

    for (const asset of assets) {
      const key = `${asset.symbol}|${asset.currency}|${asset.assetType}`;
      const value = this.getAssetValue(asset);
      const cost = asset.quantity * asset.averageCost;
      const current = grouped.get(key);

      if (current) {
        current.quantity += asset.quantity;
        current.value += value;
        current.cost += cost;
        continue;
      }

      grouped.set(key, {
        symbol: asset.symbol,
        name: asset.assetName,
        assetType: asset.assetType,
        quantity: asset.quantity,
        value,
        cost,
        currency: asset.currency,
      });
    }

    return [...grouped.values()]
      .map(row => {
        const pnl = row.value - row.cost;
        return {
          symbol: row.symbol,
          name: row.name,
          assetType: row.assetType,
          quantity: row.quantity,
          unitPrice: row.quantity > 0 ? row.value / row.quantity : 0,
          value: row.value,
          pnl,
          pnlPercent: row.cost > 0 ? (pnl / row.cost) * 100 : 0,
          currency: row.currency,
        };
      })
      .sort((left, right) => right.value - left.value);
  }

  private toHoldingRow(asset: PortfolioAsset): HoldingRow {
    const unitPrice = asset.currentValue ?? asset.averageCost;
    const value = this.getAssetValue(asset);
    const cost = asset.quantity * asset.averageCost;
    const pnl = value - cost;
    return {
      symbol: asset.symbol,
      name: asset.assetName,
      assetType: asset.assetType,
      quantity: asset.quantity,
      unitPrice,
      value,
      pnl,
      pnlPercent: cost > 0 ? (pnl / cost) * 100 : 0,
      currency: asset.currency,
    };
  }

  private getAssetValue(asset: PortfolioAsset): number {
    return asset.quantity * (asset.currentValue ?? asset.averageCost);
  }

  private getAllocationColor(label: string, index: number): string {
    const normalized = label.toLocaleLowerCase('tr-TR');
    if (normalized.includes('bist')) {
      return '--chart-bist';
    }
    if (normalized.includes('kripto') || normalized.includes('crypto')) {
      return '--chart-crypto';
    }
    if (normalized.includes('maden') || normalized.includes('metal')) {
      return '--chart-precious';
    }
    return `--chart-${(index % 12) + 1}`;
  }

  private stockToMover(stock: MarketStockPrice): MoverRow {
    return {
      symbol: stock.ticker,
      name: stock.companyName || stock.ticker,
      price: stock.price,
      changePercent: stock.changePercent,
      currency: 'TRY',
      category: 'bist',
    };
  }

  private cryptoToMover(crypto: MarketCryptoPrice): MoverRow {
    return {
      symbol: crypto.baseAsset || crypto.symbol,
      name: crypto.symbol,
      price: crypto.priceUsdt,
      changePercent: crypto.changePercent24h,
      currency: 'USD',
      category: 'crypto',
    };
  }

  private indexToMover(index: MarketIndexPrice): MoverRow {
    return {
      symbol: index.ticker,
      name: index.name,
      price: index.price,
      changePercent: index.changePercent,
      currency: '',
      category: 'index',
    };
  }

  private getMoverColor(category: MoverRow['category']): string {
    switch (category) {
      case 'bist':
        return cssVar('--chart-bist', '#2563eb');
      case 'crypto':
        return cssVar('--chart-crypto', '#f59e0b');
      case 'index':
      default:
        return cssVar('--chart-1', '#64748b');
    }
  }

  private getChartPoints(values: number[], width: number, height: number): string {
    if (values.length < 2) {
      return '';
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const pad = 14;
    return values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * width;
        const y = height - pad - ((value - min) / range) * (height - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  private getChartArea(values: number[], width: number, height: number): string {
    const points = this.getChartPoints(values, width, height);
    if (!points) {
      return '';
    }
    const parts = points.split(' ');
    const lastX = parts[parts.length - 1].split(',')[0];
    return `M ${parts[0]} L ${parts.slice(1).join(' L ')} L ${lastX},${height} L 0,${height} Z`;
  }
}
