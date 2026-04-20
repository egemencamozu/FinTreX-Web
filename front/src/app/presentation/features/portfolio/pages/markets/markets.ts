import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MarketDataRepository } from '../../../../../core/interfaces/market-data.repository';
import { InfoTooltip } from '../../../../shared/components/info-tooltip/info-tooltip';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import { HoldingsCardComponent, CardViewDirective } from '../../../../shared/components/holdings-card/holdings-card.component';
import { MoverListComponent } from '../../../../shared/components/mover-list/mover-list.component';
import { NetworkFilterPills } from '../../../../shared/components/network-filter-pills/network-filter-pills';
import type { NetworkFilterPill } from '../../../../shared/components/network-filter-pills/network-filter-pill.model';
import {
  FilterOverflowPillsComponent,
  type FilterOverflowPill,
} from '../../../../shared/components/filter-overflow-pills/filter-overflow-pills';
import type { MoverListItem } from '../../../../shared/components/mover-list/mover-list.component';
import type { SegmentedOption } from '../../../../shared/components/segmented-control/segmented-control.component';
import { MarketUiService } from '../../services/market-ui.service';
import { MarketBistTableComponent } from '../../components/market-bist-table/market-bist-table.component';
import type { StockColSort } from '../../components/market-bist-table/market-bist-table.component';
import { MarketCryptoTableComponent } from '../../components/market-crypto-table/market-crypto-table.component';
import type { CryptoColSort } from '../../components/market-crypto-table/market-crypto-table.component';
import { MarketIndicesTableComponent } from '../../components/market-indices-table/market-indices-table.component';
import {
  NumberRangeFilterComponent,
  type NumberRangeFilterPreset,
  type NumberRangeFilterValue,
} from '../../../../shared/components/number-range-filter/number-range-filter.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { MarketPricePipe } from '../../../../shared/pipes/market-price.pipe';
import { MarketChangePipe } from '../../../../shared/pipes/market-change.pipe';
import { CompactNumberPipe } from '../../../../shared/pipes/compact-number.pipe';
import {
  MarketConnectionState,
  MarketCryptoPrice,
  MarketForexRate,
  MarketGoldPrice,
  MarketGoldTypes,
  MarketIndexPrice,
  MarketSnapshot,
  MarketStockPrice,
  MarketStreamEvent,
} from '../../../../../core/models/market-data.model';

interface OverviewRow {
  market: 'BIST' | 'Kripto' | 'Endeks' | 'Altin';
  symbol: string;
  name: string;
  price: number;
  currency: 'TRY' | 'USD';
  changePercent: number;
  volume: number | null;
  updatedAt: string;
}

type MarketView = 'overview' | 'stocks' | 'crypto' | 'indices' | 'gold';

interface MarketTabItem {
  id: MarketView;
  label: string;
}

interface MarketFilterItem {
  id: string;
  label: string;
}

interface StockSectorOption {
  id: string;
  label: string;
  count: number;
}

const EMPTY_RANGE_FILTER: NumberRangeFilterValue = {
  presetId: 'any',
  min: null,
  max: null,
};

const MARKET_CAP_FILTER_PRESETS: readonly NumberRangeFilterPreset[] = [
  { id: 'any', label: 'Any', min: null, max: null },
  { id: '1m', label: '>= $1M', min: 1_000_000, max: null },
  { id: '100m', label: '>= $100M', min: 100_000_000, max: null },
  { id: '1b', label: '>= $1B', min: 1_000_000_000, max: null },
];

const VOLUME_FILTER_PRESETS: readonly NumberRangeFilterPreset[] = [
  { id: 'any', label: 'Any', min: null, max: null },
  { id: '10m', label: '>= $10M', min: 10_000_000, max: null },
  { id: '100m', label: '>= $100M', min: 100_000_000, max: null },
  { id: '1b', label: '>= $1B', min: 1_000_000_000, max: null },
];

const STOCK_VOLUME_FILTER_PRESETS: readonly NumberRangeFilterPreset[] = [
  { id: 'any', label: 'Any', min: null, max: null },
  { id: '1m', label: '>= \u20BA1M', min: 1_000_000, max: null },
  { id: '10m', label: '>= \u20BA10M', min: 10_000_000, max: null },
  { id: '100m', label: '>= \u20BA100M', min: 100_000_000, max: null },
];

@Component({
  selector: 'app-markets',
  standalone: true,
  imports: [
    CommonModule,
    KpiCardComponent,
    InfoTooltip,
    HoldingsCardComponent,
    CardViewDirective,
    MoverListComponent,
    MarketBistTableComponent,
    MarketCryptoTableComponent,
    MarketIndicesTableComponent,
    NumberRangeFilterComponent,
    PaginatorComponent,
    NetworkFilterPills,
    FilterOverflowPillsComponent,
    MarketPricePipe,
    MarketChangePipe,
    CompactNumberPipe,
  ],
  templateUrl: './markets.html',
  styleUrl: './markets.scss',
  encapsulation: ViewEncapsulation.None,
})
export class Markets implements OnInit, OnDestroy {
  private readonly marketDataRepository = inject(MarketDataRepository);
  private readonly destroyRef = inject(DestroyRef);
  readonly ui = inject(MarketUiService);

  private readonly viewFilterConfig: Record<MarketView, readonly MarketFilterItem[]> = {
    overview: [
      { id: 'all', label: 'Tüm Piyasalar' },
      { id: 'bist', label: 'BIST' },
      { id: 'crypto', label: 'Kripto' },
      { id: 'indices', label: 'Endeks' },
      { id: 'gold', label: 'Altın' },
    ],
    stocks: [
      { id: 'all', label: 'Tüm Hisseler' },
    ],
    crypto: [
      { id: 'all', label: 'Tümü' },
      { id: 'winners', label: 'Yükselen' },
      { id: 'losers', label: 'Düşen' },
      { id: 'volume', label: 'Yüksek Hacim' },
      { id: 'try', label: 'TRY Çifti' },
    ],
    indices: [
      { id: 'all', label: 'Tüm Endeksler' },
      { id: 'positive', label: 'Pozitif' },
      { id: 'negative', label: 'Negatif' },
    ],
    gold: [
      { id: 'all', label: 'Spot + Fiziki' },
      { id: 'spot', label: 'Spot' },
      { id: 'physical', label: 'Fiziki Türler' },
    ],
  };

  readonly marketTabs: readonly MarketTabItem[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'stocks', label: 'BIST' },
    { id: 'crypto', label: 'Kripto' },
    { id: 'indices', label: 'Endeks' },
    { id: 'gold', label: 'Altın' },
  ];

  // ── Loading / Connection state ─────────────────────────────────────────────
  readonly isLoading = signal(true);
  readonly isRefreshing = signal(false);
  readonly connectionState = signal<MarketConnectionState>('disconnected');
  readonly connectionError = signal<string | null>(null);
  readonly pageError = signal<string | null>(null);
  readonly lastRefresh = signal<Date | null>(null);

  // ── Market data ───────────────────────────────────────────────────────────
  readonly marketOpen = signal(false);
  readonly stocks = signal<MarketStockPrice[]>([]);
  readonly cryptos = signal<MarketCryptoPrice[]>([]);
  readonly indices = signal<MarketIndexPrice[]>([]);
  readonly usdTry = signal<MarketForexRate | null>(null);
  readonly goldSpot = signal<MarketGoldPrice | null>(null);
  readonly goldTypes = signal<MarketGoldTypes | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  readonly stockSearch = signal('');
  readonly cryptoSearch = signal('');
  readonly indexSearch = signal('');
  readonly activeView = signal<MarketView>('overview');
  readonly activeFilter = signal('all');
  readonly activeStockSector = signal('all');
  readonly favoriteCryptos = signal<Set<string>>(new Set());
  readonly activeNetwork = signal<string>('all');
  readonly stockColSort = signal<StockColSort | null>({ col: 'volume', dir: 'desc' });
  readonly cryptoColSort = signal<CryptoColSort | null>({ col: 'marketCap', dir: 'desc' });
  readonly marketCapFilter = signal<NumberRangeFilterValue>({ ...EMPTY_RANGE_FILTER });
  readonly volumeFilter = signal<NumberRangeFilterValue>({ ...EMPTY_RANGE_FILTER });
  readonly stockVolumeFilter = signal<NumberRangeFilterValue>({ ...EMPTY_RANGE_FILTER });

  // ── Network filter pills ───────────────────────────────────────────────────
  readonly networkFilterPills = computed((): NetworkFilterPill[] => [
    {
      id: 'all',
      label: 'Tümü',
      icon: 'fa-solid fa-layer-group',
      title: 'Tüm Zincirler',
    },
    {
      id: 'BNB Chain',
      label: 'BNB',
      icon: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/bnb.svg',
      isImage: true,
      title: 'BNB Chain',
    },
    {
      id: 'Ethereum',
      label: 'Ethereum',
      icon: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/eth.svg',
      isImage: true,
      title: 'Ethereum',
    },
    {
      id: 'Solana',
      label: 'Solana',
      icon: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/sol.svg',
      isImage: true,
      title: 'Solana',
    },
  ]);

  readonly stockSectorPills = computed((): FilterOverflowPill[] => [
    { id: 'all', label: 'Tümü', icon: 'fa-solid fa-layer-group' },
    ...this.orderStockSectorOptions(this.stockSectorOptions()).map(sector => ({
      id: sector.id,
      label: this.getStockSectorLabel(sector.label),
    })),
  ]);

  // ── Pagination ────────────────────────────────────────────────────────────
  readonly PAGE_SIZE = 50;
  readonly cryptoPage = signal(1);
  readonly stockPage = signal(1);

  readonly marketCapFilterPresets = MARKET_CAP_FILTER_PRESETS;
  readonly volumeFilterPresets = VOLUME_FILTER_PRESETS;
  readonly stockVolumeFilterPresets = STOCK_VOLUME_FILTER_PRESETS;

  readonly moverViewOptions: SegmentedOption[] = [
    { id: 'gainers', label: 'Yükselenler' },
    { id: 'losers', label: 'Düşenler' },
  ];

  readonly stockExtraViewOptions: SegmentedOption[] = [
    { id: 'volume', label: 'Hacim' },
  ];

  readonly bistSummaryViewOptions: SegmentedOption[] = [
    { id: 'overview', label: 'Özet' },
    { id: 'sectors', label: 'Sektörler' },
  ];


  // ── Computed: filtered lists ───────────────────────────────────────────────
  readonly filteredStocks = computed(() => {
    const query = this.stockSearch().trim().toLowerCase();
    if (!query) return this.stocks();
    return this.stocks().filter(
      item =>
        item.ticker.toLowerCase().includes(query) ||
        item.companyName.toLowerCase().includes(query) ||
        item.sector.toLowerCase().includes(query),
    );
  });

  readonly stockSectorOptions = computed<StockSectorOption[]>(() => {
    const counts = new Map<string, number>();

    for (const item of this.stocks()) {
      const sector = item.sector.trim();
      if (!sector) continue;
      counts.set(sector, (counts.get(sector) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([sector, count]) => ({ id: sector, label: sector, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'tr-TR'));
  });

  readonly filteredCryptos = computed(() => {
    const query = this.cryptoSearch().trim().toLowerCase();
    if (!query) return this.cryptos();
    return this.cryptos().filter(
      item => item.symbol.toLowerCase().includes(query) || item.baseAsset.toLowerCase().includes(query),
    );
  });

  readonly filteredIndices = computed(() => {
    const query = this.indexSearch().trim().toLowerCase();
    if (!query) return this.indices();
    return this.indices().filter(
      item => item.ticker.toLowerCase().includes(query) || item.name.toLowerCase().includes(query),
    );
  });

  // ── Computed: filtered + sorted (full list) ──────────────────────────────
  readonly visibleStocks = computed(() => {
    let items = this.applyStockSectorFilter(
      this.filteredStocks(),
      this.activeStockSector(),
    );
    const volFilter = this.stockVolumeFilter();
    if (volFilter.min !== null) items = items.filter(s => s.volume >= volFilter.min!);
    if (volFilter.max !== null) items = items.filter(s => s.volume <= volFilter.max!);
    const sort = this.stockColSort();
    if (!sort) return items;

    const { col, dir } = sort;
    const m = dir === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
      switch (col) {
        case 'price': return m * (a.price - b.price);
        case 'change': return m * (a.changePercent - b.changePercent);
        case 'volume': return m * (a.volume - b.volume);
        default: return 0;
      }
    });
  });

  readonly allVisibleCryptos = computed(() => {
    let items = this.filteredCryptos();

    const network = this.activeNetwork();
    if (network !== 'all') {
      items = items.filter(item => this.ui.getNetwork(item) === network);
    }

    items = this.applyNumericCryptoFilter(items, item => item.marketCapUsdt, this.marketCapFilter());
    items = this.applyNumericCryptoFilter(items, item => item.volume24h, this.volumeFilter());

    const sort = this.cryptoColSort();
    if (!sort) return items;

    const { col, dir } = sort;
    const m = dir === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
      switch (col) {
        case 'price':    return m * (a.priceUsdt - b.priceUsdt);
        case 'change1h': return m * ((a.changePercent1h ?? 0) - (b.changePercent1h ?? 0));
        case 'change4h': return m * ((a.changePercent4h ?? 0) - (b.changePercent4h ?? 0));
        case 'change24h': return m * (a.changePercent24h - b.changePercent24h);
        case 'volume':   return m * (a.volume24h - b.volume24h);
        case 'marketCap': return m * ((a.marketCapUsdt ?? 0) - (b.marketCapUsdt ?? 0));
        default: return 0;
      }
    });
  });

  // ── Computed: paged rows ─────────────────────────────────────────────────
  readonly visibleCryptos = computed(() => {
    const page = this.cryptoPage();
    return this.allVisibleCryptos().slice((page - 1) * this.PAGE_SIZE, page * this.PAGE_SIZE);
  });

  readonly pagedStocks = computed(() => {
    const page = this.stockPage();
    return this.visibleStocks().slice((page - 1) * this.PAGE_SIZE, page * this.PAGE_SIZE);
  });

  readonly visibleIndices = computed(() =>
    this.applyIndexFilter(this.filteredIndices(), this.activeFilter()),
  );

  // ── Computed: summary values ───────────────────────────────────────────────
  readonly bist100 = computed(() => {
    const indices = this.indices();
    return indices.find(item => item.ticker === 'XU100.IS') ?? indices[0] ?? null;
  });

  readonly btcMarket = computed(() =>
    this.cryptos().find(item => item.symbol === 'BTCUSDT') ?? this.cryptos()[0] ?? null,
  );

  readonly ethMarket = computed(() =>
    this.cryptos().find(item => item.symbol === 'ETHUSDT') ?? null,
  );

  readonly stockGainers = computed(() =>
    this.stocks().filter(item => item.changePercent > 0).length,
  );
  readonly stockLosers = computed(() =>
    this.stocks().filter(item => item.changePercent < 0).length,
  );
  readonly cryptoPositive = computed(() =>
    this.cryptos().filter(item => item.changePercent24h > 0).length,
  );
  readonly cryptoNegative = computed(() =>
    this.cryptos().filter(item => item.changePercent24h < 0).length,
  );

  readonly cryptoGainerRatio = computed(() => {
    const pos = this.cryptoPositive();
    const neg = this.cryptoNegative();
    const total = pos + neg;
    return total === 0 ? 50 : Math.round((pos / total) * 100);
  });

  readonly strongestIndex = computed(() =>
    [...this.indices()].sort((a, b) => b.changePercent - a.changePercent)[0] ?? null,
  );

  readonly weakestIndex = computed(() =>
    [...this.indices()].sort((a, b) => a.changePercent - b.changePercent)[0] ?? null,
  );

  readonly cryptoGainersList = computed(() =>
    [...this.cryptos()]
      .filter(item => item.changePercent24h > 0)
      .sort((a, b) => b.changePercent24h - a.changePercent24h)
      .slice(0, 4),
  );

  readonly cryptoLosersList = computed(() =>
    [...this.cryptos()]
      .filter(item => item.changePercent24h < 0)
      .sort((a, b) => a.changePercent24h - b.changePercent24h)
      .slice(0, 4),
  );

  readonly gainersListItems = computed<MoverListItem[]>(() =>
    this.cryptoGainersList().map(item => ({
      avatarUrl: this.ui.getCryptoLogoUrl(item.baseAsset),
      avatarFallback: this.ui.getAvatarLetter(item.baseAsset || item.symbol),
      avatarColor: this.ui.getAvatarColor(item.baseAsset || item.symbol),
      label: item.baseAsset,
      value: new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.priceUsdt),
      change: item.changePercent24h,
    })),
  );

  readonly losersListItems = computed<MoverListItem[]>(() =>
    this.cryptoLosersList().map(item => ({
      avatarUrl: this.ui.getCryptoLogoUrl(item.baseAsset),
      avatarFallback: this.ui.getAvatarLetter(item.baseAsset || item.symbol),
      avatarColor: this.ui.getAvatarColor(item.baseAsset || item.symbol),
      label: item.baseAsset,
      value: new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.priceUsdt),
      change: item.changePercent24h,
    })),
  );

  readonly volumeListItems = computed<MoverListItem[]>(() =>
    [...this.cryptos()]
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 4)
      .map(item => ({
        avatarUrl: this.ui.getCryptoLogoUrl(item.baseAsset),
        avatarFallback: this.ui.getAvatarLetter(item.baseAsset || item.symbol),
        avatarColor: this.ui.getAvatarColor(item.baseAsset || item.symbol),
        label: item.baseAsset,
        value: '$' + new Intl.NumberFormat('tr-TR', { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 2 }).format(item.volume24h),
        change: item.changePercent24h,
      })),
  );

  private formatStockVolume(volume: number): string {
    if (volume >= 1_000_000_000) return (volume / 1_000_000_000).toFixed(1) + ' Mn \u20BA';
    if (volume >= 1_000_000) return (volume / 1_000_000).toFixed(1) + ' Mn \u20BA';
    return volume.toLocaleString('tr-TR') + ' \u20BA';
  }

  private formatStockPrice(price: number): string {
    return price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20BA';
  }

  readonly stockVolumeListItems = computed<MoverListItem[]>(() =>
    [...this.stocks()]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 4)
      .map(item => ({
        avatarFallback: item.ticker.replace('.IS', '').slice(0, 3),
        avatarColor: this.ui.getAvatarColor(item.ticker),
        label: item.ticker.replace('.IS', ''),
        value: this.formatStockVolume(item.volume),
        change: item.changePercent,
      })),
  );

  readonly stockGainersList = computed(() =>
    [...this.stocks()]
      .filter(item => item.changePercent > 0)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 4),
  );

  readonly stockLosersList = computed(() =>
    [...this.stocks()]
      .filter(item => item.changePercent < 0)
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, 4),
  );

  readonly stockGainersListItems = computed<MoverListItem[]>(() =>
    this.stockGainersList().map(item => ({
      avatarFallback: item.ticker.replace('.IS', '').slice(0, 3),
      avatarColor: this.ui.getAvatarColor(item.ticker),
      label: item.ticker.replace('.IS', ''),
      value: this.formatStockPrice(item.price),
      change: item.changePercent,
    })),
  );

  readonly stockLosersListItems = computed<MoverListItem[]>(() =>
    this.stockLosersList().map(item => ({
      avatarFallback: item.ticker.replace('.IS', '').slice(0, 3),
      avatarColor: this.ui.getAvatarColor(item.ticker),
      label: item.ticker.replace('.IS', ''),
      value: this.formatStockPrice(item.price),
      change: item.changePercent,
    })),
  );

  readonly sectorSummary = computed(() => {
    const map = new Map<string, { totalChange: number; count: number }>();
    for (const item of this.stocks()) {
      const s = item.sector?.trim();
      if (!s) continue;
      const existing = map.get(s) ?? { totalChange: 0, count: 0 };
      map.set(s, { totalChange: existing.totalChange + item.changePercent, count: existing.count + 1 });
    }
    return [...map.entries()].map(([sector, { totalChange, count }]) => ({
      sector,
      avgChange: totalChange / count,
      count,
    }));
  });

  private sectorAbbr(sector: string): string {
    const words = sector.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 3).toLocaleUpperCase('tr-TR');
    return words.map(w => w[0]).join('').slice(0, 3).toLocaleUpperCase('tr-TR');
  }

  readonly sectorGainersListItems = computed<MoverListItem[]>(() =>
    [...this.sectorSummary()]
      .sort((a, b) => b.avgChange - a.avgChange)
      .slice(0, 4)
      .map(item => ({
        avatarFallback: this.sectorAbbr(item.sector),
        avatarColor: this.ui.getAvatarColor(item.sector),
        label: item.sector,
        value: item.count + ' hisse',
        change: item.avgChange,
      })),
  );

  readonly sectorLosersListItems = computed<MoverListItem[]>(() =>
    [...this.sectorSummary()]
      .sort((a, b) => a.avgChange - b.avgChange)
      .slice(0, 4)
      .map(item => ({
        avatarFallback: this.sectorAbbr(item.sector),
        avatarColor: this.ui.getAvatarColor(item.sector),
        label: item.sector,
        value: item.count + ' hisse',
        change: item.avgChange,
      })),
  );

  readonly sectorBars = computed(() => {
    const sorted = [...this.sectorSummary()]
      .sort((a, b) => b.avgChange - a.avgChange);
    const maxAbs = Math.max(...sorted.map(s => Math.abs(s.avgChange)), 0.01);
    return sorted.map(s => ({
      sector: s.sector,
      avgChange: s.avgChange,
      barWidth: Math.round((Math.abs(s.avgChange) / maxAbs) * 100),
    }));
  });

  readonly stockGainerRatio = computed(() => {
    const pos = this.stockGainers();
    const neg = this.stockLosers();
    const total = pos + neg;
    return total === 0 ? 50 : Math.round((pos / total) * 100);
  });

  readonly goldPhysicalRows = computed(() => {
    const gt = this.goldTypes();
    if (!gt) return [];
    return [
      { symbol: 'GRAM', name: 'Gram AltÄ±n', price: gt.gramTry },
      { symbol: 'CEYREK', name: 'Ã‡eyrek AltÄ±n', price: gt.ceyrekTry },
      { symbol: 'YARIM', name: 'YarÄ±m AltÄ±n', price: gt.yarimTry },
      { symbol: 'TAM', name: 'Tam AltÄ±n', price: gt.tamTry },
      { symbol: 'CUMHUR', name: 'Cumhuriyet AltÄ±nÄ±', price: gt.cumhuriyetTry },
      { symbol: 'ATA', name: 'Ata AltÄ±nÄ±', price: gt.ataTry },
    ];
  });

  readonly overviewRows = computed(() => {
    const filter = this.activeFilter();
    const stockRows = this.toStockOverviewRows();
    const cryptoRows = this.toCryptoOverviewRows();
    const indexRows = this.toIndexOverviewRows();
    const goldRows = this.toGoldOverviewRows();

    if (filter === 'bist') return stockRows;
    if (filter === 'crypto') return cryptoRows;
    if (filter === 'indices') return indexRows;
    if (filter === 'gold') return goldRows;

    return [...stockRows.slice(0, 8), ...cryptoRows.slice(0, 8), ...indexRows.slice(0, 6), ...goldRows];
  });

  readonly activeRowCount = computed(() => {
    switch (this.activeView()) {
      case 'stocks': return this.visibleStocks().length;
      case 'crypto': return this.visibleCryptos().length;
      case 'indices': return this.visibleIndices().length;
      case 'gold': return this.goldTypes() ? 6 : this.goldSpot() ? 1 : 0;
      default: return this.overviewRows().length;
    }
  });

  readonly activeFilters = computed(() => this.viewFilterConfig[this.activeView()]);

  readonly connectionLabel = computed(() => {
    switch (this.connectionState()) {
      case 'connected': return 'Canli baglanti aktif';
      case 'connecting': return 'Baglaniyor';
      case 'reconnecting': return 'Yeniden baglaniyor';
      default: return 'Canli baglanti kapali';
    }
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadSnapshot(true);
    this.connectLiveFeed();
  }

  ngOnDestroy(): void {
    void this.marketDataRepository.disconnect();
  }

  // ── Public actions ─────────────────────────────────────────────────────────
  refreshSnapshot(): void {
    this.loadSnapshot(false);
  }

  setActiveView(view: MarketView): void {
    if (this.activeView() === view) return;
    const defaultFilter = this.viewFilterConfig[view][0]?.id ?? 'all';
    this.activeView.set(view);
    this.activeFilter.set(defaultFilter);
    this.activeStockSector.set('all');
    this.stockVolumeFilter.set({ ...EMPTY_RANGE_FILTER });
    this.cryptoPage.set(1);
    this.stockPage.set(1);
  }

  setActiveFilter(filterId: string): void {
    this.activeFilter.set(filterId);
    this.cryptoPage.set(1);
    this.stockPage.set(1);
  }

  setActiveStockSector(sector: string): void {
    this.activeStockSector.set(sector);
    this.stockPage.set(1);
  }

  toggleFavorite(symbol: string): void {
    this.favoriteCryptos.update(set => {
      const next = new Set(set);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  }

  setActiveNetwork(network: string): void {
    this.activeNetwork.set(network);
    this.cryptoPage.set(1);
  }

  onCryptoSortChange(sort: CryptoColSort | null): void {
    this.cryptoColSort.set(sort);
    this.cryptoPage.set(1);
  }

  onStockSortChange(sort: StockColSort | null): void {
    this.stockColSort.set(sort);
    this.stockPage.set(1);
  }

  onMarketCapFilterApply(value: NumberRangeFilterValue): void {
    this.marketCapFilter.set(value);
    this.cryptoPage.set(1);
  }

  onVolumeFilterApply(value: NumberRangeFilterValue): void {
    this.volumeFilter.set(value);
    this.cryptoPage.set(1);
  }

  onStockVolumeFilterApply(value: NumberRangeFilterValue): void {
    this.stockVolumeFilter.set(value);
    this.stockPage.set(1);
  }

  // ── Tracking functions ─────────────────────────────────────────────────────
  trackByOverviewSymbol(_: number, item: OverviewRow): string {
    return `${item.market}-${item.symbol}`;
  }

  // ── Private: data loading ─────────────────────────────────────────────────
  private loadSnapshot(initialLoad: boolean): void {
    if (initialLoad) this.isLoading.set(true);
    else this.isRefreshing.set(true);

    this.pageError.set(null);

    this.marketDataRepository
      .getSnapshot()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: snapshot => {
          this.applySnapshot(snapshot);
          void this.syncLiveSubscriptions();
          this.lastRefresh.set(new Date());
          this.isLoading.set(false);
          this.isRefreshing.set(false);
        },
        error: () => {
          this.pageError.set('Piyasa verileri yuklenemedi. Lutfen tekrar deneyin.');
          this.isLoading.set(false);
          this.isRefreshing.set(false);
        },
      });
  }

  private connectLiveFeed(): void {
    this.marketDataRepository
      .connect()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: event => this.handleStreamEvent(event) });
  }

  private handleStreamEvent(event: MarketStreamEvent): void {
    switch (event.type) {
      case 'connection':
        this.connectionState.set(event.state);
        this.connectionError.set(event.errorMessage ?? null);
        if (event.state === 'connected') {
          this.loadSnapshot(false);
          void this.syncLiveSubscriptions();
        }
        return;
      case 'stock': this.upsertStock(event.payload); return;
      case 'crypto': this.upsertCrypto(event.payload); return;
      case 'index': this.upsertIndex(event.payload); return;
      case 'forex':
        this.usdTry.set(event.payload);
        this.lastRefresh.set(new Date());
        return;
      case 'gold':
        this.goldSpot.set(event.payload);
        this.lastRefresh.set(new Date());
        return;
    }
  }

  private applySnapshot(snapshot: MarketSnapshot): void {
    this.marketOpen.set(snapshot.marketOpen);
    this.stocks.set([...snapshot.stocks].sort((a, b) => a.ticker.localeCompare(b.ticker, 'tr-TR')));
    this.cryptos.set(
      [...snapshot.cryptos]
        .filter(c => this.isValidCryptoSymbol(c.symbol))
        .sort((a, b) => b.volume24h * b.priceUsdt - a.volume24h * a.priceUsdt),
    );
    this.indices.set(
      [...snapshot.indices].sort((a, b) => a.ticker.localeCompare(b.ticker, 'tr-TR')),
    );
    this.usdTry.set(snapshot.usdTry);
    this.goldSpot.set(snapshot.goldSpot);
    this.goldTypes.set(snapshot.goldTypes);
  }

  private upsertStock(payload: MarketStockPrice): void {
    this.stocks.update(current => {
      const index = current.findIndex(item => item.ticker === payload.ticker);
      if (index === -1) return [...current, payload].sort((a, b) => a.ticker.localeCompare(b.ticker, 'tr-TR'));
      const next = [...current];
      next[index] = payload;
      return next;
    });
    this.lastRefresh.set(new Date());
  }

  private upsertCrypto(payload: MarketCryptoPrice): void {
    if (!this.isValidCryptoSymbol(payload.symbol)) return;
    this.cryptos.update(current => {
      const index = current.findIndex(item => item.symbol === payload.symbol);
      if (index === -1) return [...current, payload].sort((a, b) => b.volume24h * b.priceUsdt - a.volume24h * a.priceUsdt);
      const next = [...current];
      next[index] = payload;
      return next;
    });
    this.lastRefresh.set(new Date());
  }

  private upsertIndex(payload: MarketIndexPrice): void {
    this.indices.update(current => {
      const index = current.findIndex(item => item.ticker === payload.ticker);
      if (index === -1) return [...current, payload].sort((a, b) => a.ticker.localeCompare(b.ticker, 'tr-TR'));
      const next = [...current];
      next[index] = payload;
      return next;
    });
    this.lastRefresh.set(new Date());
  }

  private isValidCryptoSymbol(symbol: string): boolean {
    return /^[A-Z0-9_\-.]+$/.test(symbol);
  }

  private async syncLiveSubscriptions(): Promise<void> {
    const stockTickers = this.stocks().map(item => item.ticker);
    const cryptoSymbols = this.cryptos().map(item => item.symbol);
    await this.marketDataRepository.subscribeToStocks(stockTickers);
    await this.marketDataRepository.subscribeToCryptos(cryptoSymbols);
  }

  private applyStockSectorFilter(items: MarketStockPrice[], sector: string): MarketStockPrice[] {
    if (sector === 'all') return items;
    return items.filter(item => item.sector === sector);
  }

  private orderStockSectorOptions(options: StockSectorOption[]): StockSectorOption[] {
    const excluded = (label: string) => {
      const l = label.toLocaleLowerCase('tr-TR');
      return (
        l.includes('gayrimenkul') ||
        l.includes('elektrik') ||
        l.includes('holding') ||
        l.includes('yatırım')
      );
    };

    const filtered = options.filter(option => !excluded(option.label));

    const preferred = [
      filtered.find(option => option.label.toLocaleLowerCase('tr-TR') === 'imalat'),
      filtered.find(option => option.label.toLocaleLowerCase('tr-TR').includes('banka')),
      filtered.find(option => option.label.toLocaleLowerCase('tr-TR').includes('etf')),
    ].filter((option): option is StockSectorOption => option !== undefined);

    const preferredIds = new Set(preferred.map(option => option.id));
    return [...preferred, ...filtered.filter(option => !preferredIds.has(option.id))];
  }

  private getStockSectorLabel(label: string): string {
    return label.toLocaleLowerCase('tr-TR').includes('banka') ? 'Banka' : label;
  }

  private applyIndexFilter(items: MarketIndexPrice[], filterId: string): MarketIndexPrice[] {
    switch (filterId) {
      case 'positive': return items.filter(item => item.changePercent > 0);
      case 'negative': return items.filter(item => item.changePercent < 0);
      default: return items;
    }
  }

  private applyNumericCryptoFilter(
    items: MarketCryptoPrice[],
    selector: (item: MarketCryptoPrice) => number | null,
    filter: NumberRangeFilterValue,
  ): MarketCryptoPrice[] {
    const min = filter.min;
    const max = filter.max;

    if (min === null && max === null) {
      return items;
    }

    return items.filter(item => {
      const value = selector(item);
      if (value === null || Number.isNaN(value)) {
        return false;
      }
      if (min !== null && value < min) {
        return false;
      }
      if (max !== null && value > max) {
        return false;
      }
      return true;
    });
  }

  private toStockOverviewRows(): OverviewRow[] {
    return [...this.stocks()]
      .sort((a, b) => b.volume - a.volume)
      .map(item => ({
        market: 'BIST' as const,
        symbol: item.ticker,
        name: item.companyName,
        price: item.price,
        currency: 'TRY' as const,
        changePercent: item.changePercent,
        volume: item.volume,
        updatedAt: item.updatedAt,
      }));
  }

  private toCryptoOverviewRows(): OverviewRow[] {
    return [...this.cryptos()]
      .sort((a, b) => b.volume24h - a.volume24h)
      .map(item => ({
        market: 'Kripto' as const,
        symbol: item.symbol,
        name: item.baseAsset,
        price: item.priceUsdt,
        currency: 'USD' as const,
        changePercent: item.changePercent24h,
        volume: item.volume24h,
        updatedAt: item.updatedAt,
      }));
  }

  private toIndexOverviewRows(): OverviewRow[] {
    return [...this.indices()]
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .map(item => ({
        market: 'Endeks' as const,
        symbol: item.ticker,
        name: item.name,
        price: item.price,
        currency: 'TRY' as const,
        changePercent: item.changePercent,
        volume: null,
        updatedAt: item.updatedAt,
      }));
  }

  private toGoldOverviewRows(): OverviewRow[] {
    const rows: OverviewRow[] = [];
    const spot = this.goldSpot();
    const types = this.goldTypes();

    if (spot) {
      rows.push({ market: 'Altin', symbol: 'XAU/TRY', name: 'Gram Spot', price: spot.gramTry, currency: 'TRY', changePercent: 0, volume: null, updatedAt: spot.updatedAt });
    }
    if (types) {
      rows.push(
        { market: 'Altin', symbol: 'CEYREK', name: 'Ceyrek Altin', price: types.ceyrekTry, currency: 'TRY', changePercent: 0, volume: null, updatedAt: types.updatedAt },
        { market: 'Altin', symbol: 'YARIM', name: 'Yarim Altin', price: types.yarimTry, currency: 'TRY', changePercent: 0, volume: null, updatedAt: types.updatedAt },
        { market: 'Altin', symbol: 'TAM', name: 'Tam Altin', price: types.tamTry, currency: 'TRY', changePercent: 0, volume: null, updatedAt: types.updatedAt },
        { market: 'Altin', symbol: 'CUMHUR', name: 'Cumhuriyet Altini', price: types.cumhuriyetTry, currency: 'TRY', changePercent: 0, volume: null, updatedAt: types.updatedAt },
        { market: 'Altin', symbol: 'ATA', name: 'Ata Altini', price: types.ataTry, currency: 'TRY', changePercent: 0, volume: null, updatedAt: types.updatedAt },
      );
    }
    return rows;
  }
}
