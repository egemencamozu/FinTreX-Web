import {
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  HoldingsCardComponent,
  CardViewDirective,
} from '../../../../shared/components/holdings-card/holdings-card.component';
import {
  MoverListComponent,
  MoverListItem,
} from '../../../../shared/components/mover-list/mover-list.component';
import { SegmentedOption } from '../../../../shared/components/segmented-control/segmented-control.component';
import { NetworkFilterPills } from '../../../../shared/components/network-filter-pills/network-filter-pills';
import type { NetworkFilterPill } from '../../../../shared/components/network-filter-pills/network-filter-pill.model';
import {
  MarketBistTableComponent,
  StockColSort,
} from '../../components/market-bist-table/market-bist-table.component';
import {
  MarketCryptoTableComponent,
  CryptoColSort,
} from '../../components/market-crypto-table/market-crypto-table.component';
import { MarketAssetCellComponent } from '../../components/market-asset-cell/market-asset-cell.component';
import { MarketUiService } from '../../services/market-ui.service';
import {
  MarketCryptoPrice,
  MarketGoldPrice,
  MarketStockPrice,
} from '../../../../../core/models/market-data.model';
import { MarketDataRepository } from '../../../../../core/interfaces/market-data.repository';
import { AlertEditorDrawerComponent } from '../../components/alert-editor-drawer/alert-editor-drawer.component';
import {
  AssetSelectModalComponent,
  SelectedAsset,
} from '../../components/asset-select-modal/asset-select-modal.component';
import { AuthService } from '../../../../../core/services/auth.service';
import { MarketDataSignalRService } from '../../../../../core/services/market-data-signalr.service';
import { WatchlistApiService } from '../../../../../core/services/watchlist-api.service';
import { PriceAlertApiService } from '../../../../../core/services/price-alert-api.service';
import { AlertsSignalRService } from '../../../../../core/services/alerts-signalr.service';
import { AlertService } from '../../../../../core/services/alert.service';
import type {
  AlertAssetType,
  PriceAlert,
} from '../../../../../core/models/price-alert.model';
import type { WatchlistAssetType } from '../../../../../core/models/watchlist.model';

// ---------------------------------------------------------------------------
// Watchlist sayfası — backend + canlı market data entegrasyonu
// ---------------------------------------------------------------------------
// Varlıklar `WatchlistApiService`'ten gelir, fiyat/değişim verisi
// `MarketDataRepository` (snapshot + canlı SignalR) ile anlık güncellenir,
// alarm panelleri `PriceAlertApiService` ile beslenir.
// ---------------------------------------------------------------------------

export type WatchlistCategory = 'bist' | 'crypto' | 'metal';
type MainTab = WatchlistCategory | 'alarmlar';
type AddModalAssetType = 'BIST' | 'Crypto' | 'PreciousMetal';
type AlarmFilter = 'all' | 'active' | 'triggered' | 'paused';

type SortField = 'rank' | 'symbol' | 'name' | 'price' | 'changePercent' | 'volume' | 'marketCap';

interface EnrichedItem {
  /** Backend watchlist item id (string). */
  id: string;
  /** Kullanıcının izleme listesindeki sıra — filtrelenmiş listeye göre atanır. */
  rank: number;
  symbol: string;
  name: string;
  category: WatchlistCategory;
  price: number;
  currency: 'TRY' | 'USD';
  change: number;
  changePercent: number;
  change1h: number | null;
  volume: number;
  marketCap: number | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
  updatedAt: string;
  /** Kullanıcının bu sembol için en az bir aktif alarmı var mı? */
  alertEnabled: boolean;
  /** Spotlight grafiği için opsiyonel tarihsel seri (şu an kullanılmıyor). */
  sparkline?: number[];
}

interface TabConfig {
  id: MainTab;
  label: string;
  colorClass: string;
}

interface AlertTargetRow {
  item: EnrichedItem;
  alert: PriceAlert;
  targetPrice: number;
  direction: number; // +1 ABOVE, -1 BELOW
  hit: boolean;
  distancePct: number;
  progress: number;
}

const CATEGORY_COLORS: Record<WatchlistCategory, string> = {
  bist: 'var(--chart-bist)',
  crypto: 'var(--chart-crypto)',
  metal: 'var(--chart-precious, #C9970C)',
};

interface MetalMarketState {
  price: number;
  currency: 'TRY' | 'USD';
  changePercent: number;
  updatedAt: string;
}

@Component({
  selector: 'app-watchlist',
  standalone: true,
  imports: [
    MoverListComponent,
    NetworkFilterPills,
    HoldingsCardComponent,
    CardViewDirective,
    MarketBistTableComponent,
    MarketCryptoTableComponent,
    AlertEditorDrawerComponent,
    AssetSelectModalComponent,
    MarketAssetCellComponent,
  ],
  templateUrl: './watchlist.html',
  styleUrl: './watchlist.scss',
})
export class Watchlist implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  readonly ui = inject(MarketUiService);
  private readonly watchlistApi = inject(WatchlistApiService);
  private readonly priceAlertApi = inject(PriceAlertApiService);
  private readonly alertsSignalR = inject(AlertsSignalRService);
  private readonly marketRepo = inject(MarketDataRepository);
  private readonly marketSignalR = inject(MarketDataSignalRService);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  // ── Tab tanımı ───────────────────────────────────────────────────────
  readonly tabs: TabConfig[] = [
    { id: 'bist', label: 'BIST', colorClass: 'bist' },
    { id: 'crypto', label: 'Kripto', colorClass: 'crypto' },
    { id: 'metal', label: 'Değerli Maden', colorClass: 'metal' },
    { id: 'alarmlar', label: 'Alarmlar', colorClass: 'alarms' },
  ];

  // ── Watchlists (backend) ──────────────────────────────────────────────
  readonly watchlists = this.watchlistApi.watchlists;
  readonly activeWatchlistId = signal<string>('');
  readonly requestedWatchlistId = signal<string>('');
  readonly showWlActionsMenu = signal(false);
  readonly showNewWlModal = signal(false);
  readonly showRenameWlModal = signal(false);
  readonly newWlName = signal('');
  readonly busy = signal(false);

  readonly activeWatchlist = computed(
    () => this.watchlists().find(w => w.id === this.activeWatchlistId()) ?? null,
  );

  // ── Market data cache ─────────────────────────────────────────────────
  private readonly stockMap = signal<Map<string, MarketStockPrice>>(new Map());
  private readonly cryptoMap = signal<Map<string, MarketCryptoPrice>>(new Map());
  readonly goldSpot = signal<MarketGoldPrice | null>(null);
  private readonly metalChanges = signal<Map<string, number>>(new Map());
  private readonly marketSnapshotLoaded = signal(false);
  readonly usdTryRate = signal(0);

  // ── Tablo UI state ────────────────────────────────────────────────────
  readonly activeTab = signal<MainTab>('bist');
  readonly searchQuery = signal('');
  readonly sortField = signal<SortField>('rank');
  readonly sortDirection = signal<'asc' | 'desc'>('asc');
  readonly showAddModal = signal(false);
  readonly addModalAssetType = signal<AddModalAssetType>('BIST');
  readonly alarmFilter = signal<AlarmFilter>('all');

  readonly stockColSort = signal<StockColSort | null>(null);
  readonly cryptoColSort = signal<CryptoColSort | null>(null);
  readonly addAssetTypeOptions: ReadonlyArray<{
    value: AddModalAssetType;
    label: string;
    icon: string;
  }> = [
    { value: 'BIST', label: 'BIST', icon: 'fa-solid fa-building-columns' },
    { value: 'Crypto', label: 'Kripto', icon: 'fa-brands fa-bitcoin' },
    { value: 'PreciousMetal', label: 'Değerli Metal', icon: 'fa-solid fa-gem' },
  ];

  // ── Alarm drawer state ────────────────────────────────────────────────
  readonly alertDrawerOpen = signal(false);
  readonly alertDrawerSymbol = signal('');
  readonly alertDrawerName = signal('');
  readonly alertDrawerAssetType = signal<AlertAssetType>('BIST');
  readonly alertDrawerPrice = signal(0);
  readonly alertDrawerCurrency = signal<'TRY' | 'USD'>('TRY');
  readonly alertDrawerExistingAlert = signal<PriceAlert | null>(null);
  readonly alertDrawerUserEmail = computed(
    () => this.authService.getCurrentUser()?.email ?? '',
  );

  // ── Segmented control opsiyonları ─────────────────────────────────────
  readonly moverViewOptions: SegmentedOption[] = [
    { id: 'gainers', label: 'Yükselenler' },
    { id: 'losers', label: 'Düşenler' },
  ];

  readonly alarmViewOptions: SegmentedOption[] = [
    { id: 'hit', label: 'Ulaşanlar' },
    { id: 'pending', label: 'Ulaşmayanlar' },
  ];

  // ── Tüm kullanıcıya ait alarmlar — rozet/panel için ──────────────────
  private readonly alerts = this.priceAlertApi.alerts;

  /** Aktif watchlist'in ham item'ları (backend). */
  private readonly rawItems = computed(() => {
    const wlId = this.activeWatchlistId();
    if (!wlId) return [];
    return this.watchlistApi.itemsInWatchlist(wlId);
  });
  readonly watchlistSymbols = computed(() =>
    this.rawItems().map(item => item.symbol),
  );

  /** Item'ların fiyat/değişim ile zenginleştirilmiş hali. */
  readonly allItems = computed<EnrichedItem[]>(() => {
    const raw = this.rawItems();
    const alertSet = new Set(
      this.alerts()
        .filter(a => a.status === 'ACTIVE' || a.status === 'TRIGGERED')
        .map(a => a.symbol),
    );

    const out: EnrichedItem[] = [];
    let idx = 0;
    for (const it of raw) {
      if (it.assetType === 'BIST') {
        const market = this.findStockBySymbol(it.symbol);
        out.push({
          id: it.id,
          rank: ++idx,
          symbol: it.symbol,
          name: it.assetName || market?.companyName || it.symbol,
          category: 'bist',
          price: market?.price ?? 0,
          currency: 'TRY',
          change: market?.change ?? 0,
          changePercent: market?.changePercent ?? 0,
          change1h: null,
          volume: market?.volume ?? 0,
          marketCap: null,
          circulatingSupply: null,
          totalSupply: null,
          updatedAt: market?.updatedAt ?? '',
          alertEnabled: alertSet.has(it.symbol),
        });
      } else if (it.assetType === 'CRYPTO') {
        const market = this.findCryptoByBaseAsset(it.symbol);
        const usdPrice = market?.priceUsdt ?? 0;
        out.push({
          id: it.id,
          rank: ++idx,
          symbol: it.symbol,
          name: it.assetName || market?.baseAsset || it.symbol,
          category: 'crypto',
          price: usdPrice,
          currency: 'USD',
          change: 0,
          changePercent: market?.changePercent24h ?? 0,
          change1h: market?.changePercent1h ?? null,
          volume: market?.volume24h ?? 0,
          marketCap: market?.marketCapUsdt ?? null,
          circulatingSupply: market?.circulatingSupply ?? null,
          totalSupply: market?.totalSupply ?? null,
          updatedAt: market?.updatedAt ?? '',
          alertEnabled: alertSet.has(it.symbol),
        });
      } else if (it.assetType === 'METAL') {
        const metal = this.resolveMetalMarket(it.symbol);
        out.push({
          id: it.id,
          rank: ++idx,
          symbol: it.symbol,
          name: it.assetName || it.symbol,
          category: 'metal',
          price: metal.price,
          currency: metal.currency,
          change: 0,
          changePercent: 0,
          change1h: null,
          volume: 0,
          marketCap: null,
          circulatingSupply: null,
          totalSupply: null,
          updatedAt: metal.updatedAt,
          alertEnabled: alertSet.has(it.symbol),
        });
      }
    }
    return out;
  });

  readonly activeItems = computed(() =>
    this.allItems().filter(i => i.category === this.activeTab()),
  );

  readonly filteredItems = computed<EnrichedItem[]>(() => {
    let items = this.activeItems();
    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      items = items.filter(
        i => i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q),
      );
    }
    const field = this.sortField();
    const dir = this.sortDirection();
    return [...items].sort((a, b) => {
      const av = a[field as keyof EnrichedItem] as string | number | null;
      const bv = b[field as keyof EnrichedItem] as string | number | null;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === 'string' && typeof bv === 'string') {
        return dir === 'asc' ? av.localeCompare(bv, 'tr') : bv.localeCompare(av, 'tr');
      }
      return dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  });

  // ── Tabloya bağlanacak adapted veriler ────────────────────────────────
  readonly filteredAsStocks = computed<MarketStockPrice[]>(() =>
    this.filteredItems().map(i => ({
      ticker: i.symbol,
      companyName: i.name,
      sector: '',
      price: i.price,
      change: i.change,
      changePercent: i.changePercent,
      volume: i.volume,
      updatedAt: i.updatedAt || new Date().toISOString(),
    })),
  );

  readonly filteredAsCryptos = computed<MarketCryptoPrice[]>(() =>
    this.filteredItems().map(i => {
      const live = this.findCryptoByBaseAsset(i.symbol);
      return {
        symbol: i.symbol,
        baseAsset: i.name,
        priceUsdt: live?.priceUsdt ?? i.price,
        priceTry: live?.priceTry ?? 0,
        changePercent1h: i.change1h,
        changePercent4h: live?.changePercent4h ?? null,
        changePercent24h: i.changePercent,
        marketCapUsdt: i.marketCap,
        circulatingSupply: i.circulatingSupply,
        totalSupply: i.totalSupply,
        network: live?.network ?? null,
        volume24h: i.volume,
        trySource: live?.trySource ?? '',
        updatedAt: i.updatedAt || new Date().toISOString(),
      };
    }),
  );

  readonly filteredAsMetals = computed<MarketStockPrice[]>(() =>
    this.filteredItems().map(i => ({
      ticker: i.symbol,
      companyName: i.name,
      sector: 'Değerli Maden',
      price: i.price,
      change: 0,
      changePercent: i.changePercent,
      volume: 0,
      updatedAt: i.updatedAt || new Date().toISOString(),
    })),
  );

  // Tablo zaten watchlist satırında "remove" aksiyonunu kullandığı için
  // yıldız bulunmuyor, ama tipi sağlaman gerekiyor.
  readonly favoriteSymbols = computed<Set<string>>(() => new Set());

  // ── Sayılar / özetler ────────────────────────────────────────────────
  readonly totalCount = computed(() => this.allItems().length);
  readonly gainersCount = computed(
    () => this.allItems().filter(i => i.changePercent > 0).length,
  );
  readonly losersCount = computed(
    () => this.allItems().filter(i => i.changePercent < 0).length,
  );
  readonly alertsCount = computed(
    () => this.allItems().filter(i => i.alertEnabled).length,
  );

  readonly categoryCount = computed(() => {
    const items = this.allItems();
    return {
      bist: items.filter(i => i.category === 'bist').length,
      crypto: items.filter(i => i.category === 'crypto').length,
      metal: items.filter(i => i.category === 'metal').length,
    };
  });

  readonly alarmsLinkedCount = computed(
    () => this.alerts().filter(a => !!a.watchlistId).length,
  );

  readonly avgChange = computed(() => {
    const items = this.activeItems();
    if (!items.length) return 0;
    return items.reduce((sum, i) => sum + i.changePercent, 0) / items.length;
  });

  readonly spotlightItem = computed<EnrichedItem | null>(() => {
    const items = this.activeItems();
    if (!items.length) return null;
    const top = [...items].sort((a, b) => b.changePercent - a.changePercent)[0];
    return { ...top, sparkline: this.mockSparkline(top.symbol, top.changePercent) };
  });

  private mockSparkline(symbol: string, changePercent: number): number[] {
    let seed = 0;
    for (let i = 0; i < symbol.length; i++) seed = (seed * 31 + symbol.charCodeAt(i)) >>> 0;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; };
    const n = 24;
    const pts: number[] = [0.5];
    for (let i = 1; i < n; i++) pts.push(pts[i - 1] + (rand() - 0.5) * 0.15);
    const mn = Math.min(...pts), mx = Math.max(...pts), range = mx - mn || 1;
    const norm = pts.map(v => (v - mn) / range);
    const dir = changePercent >= 0 ? 1 : -1;
    return norm.map((v, i) => v * 0.5 + (i / (n - 1)) * 0.5 * (dir > 0 ? 1 : 0) + (dir < 0 ? 0.5 * (1 - i / (n - 1)) : 0));
  }

  readonly topGainers = computed(() =>
    [...this.allItems()]
      .filter(i => i.changePercent > 0)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 4),
  );
  readonly topLosers = computed(() =>
    [...this.allItems()]
      .filter(i => i.changePercent < 0)
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, 4),
  );

  readonly topGainersMovers = computed<MoverListItem[]>(() =>
    this.topGainers().map(i => this.toMoverItem(i)),
  );
  readonly topLosersMovers = computed<MoverListItem[]>(() =>
    this.topLosers().map(i => this.toMoverItem(i)),
  );

  // ── Alarm panel verisi ───────────────────────────────────────────────
  readonly alertTargetsAll = computed<AlertTargetRow[]>(() => {
    const watchItems = this.allItems();
    const bySymbol = new Map<string, EnrichedItem>();
    for (const i of watchItems) bySymbol.set(i.symbol, i);

    const rows: AlertTargetRow[] = [];
    for (const alert of this.alerts()) {
      const item = bySymbol.get(alert.symbol);
      if (!item) continue;
      const direction = alert.direction === 'ABOVE' ? 1 : -1;

      let targetPrice: number;
      if (alert.kind === 'PRICE') {
        targetPrice = alert.targetValue;
      } else {
        const baseline = alert.baselinePrice ?? item.price;
        targetPrice = baseline * (1 + (direction * alert.targetValue) / 100);
      }

      const hit = alert.status === 'TRIGGERED';
      const distancePct = item.price > 0 ? ((targetPrice - item.price) / item.price) * 100 : 0;
      const progress = this.computeProgress(item.price, targetPrice, direction);
      rows.push({ item, alert, targetPrice, direction, hit, distancePct, progress });
    }
    rows.sort((a, b) => Number(b.hit) - Number(a.hit) || b.progress - a.progress);
    return rows;
  });

  readonly alertTargetsHit = computed(() => this.alertTargetsAll().filter(a => a.hit));
  readonly alertTargetsPending = computed(() => this.alertTargetsAll().filter(a => !a.hit));

  // Alarmlar tab'ı — watchlist join'i olmadan tüm alarmları gruplar
  readonly alarmsActive = computed(() =>
    this.alerts().filter(a => a.status === 'ACTIVE'),
  );
  readonly alarmsTriggered = computed(() =>
    this.alerts().filter(a => a.status === 'TRIGGERED'),
  );
  readonly alarmsPaused = computed(() =>
    this.alerts().filter(a => a.status === 'PAUSED'),
  );
  readonly alarmFilterPills = computed((): NetworkFilterPill[] => [
    { id: 'all', label: `Hepsi ${this.alarmsActive().length + this.alarmsTriggered().length + this.alarmsPaused().length}`, icon: 'fa-solid fa-layer-group' },
    { id: 'active', label: `Bekleyen ${this.alarmsActive().length}`, icon: 'fa-regular fa-clock' },
    { id: 'triggered', label: `Ulaştı ${this.alarmsTriggered().length}`, icon: 'fa-solid fa-check' },
    { id: 'paused', label: `Duraklatıldı ${this.alarmsPaused().length}`, icon: 'fa-solid fa-pause' },
  ]);
  readonly alarmsVisibleCount = computed(() => {
    switch (this.alarmFilter()) {
      case 'active':
        return this.alarmsActive().length;
      case 'triggered':
        return this.alarmsTriggered().length;
      case 'paused':
        return this.alarmsPaused().length;
      default:
        return this.alarmsActive().length + this.alarmsTriggered().length + this.alarmsPaused().length;
    }
  });

  setAlarmFilter(id: string): void {
    if (id === 'all' || id === 'active' || id === 'triggered' || id === 'paused') {
      this.alarmFilter.set(id);
    }
  }

  alertTargetPriceLabel(a: PriceAlert): string {
    if (a.kind === 'PRICE') {
      return `${a.direction === 'ABOVE' ? '▴' : '▾'} ${a.targetValue.toLocaleString('tr-TR')} ${a.currency}`;
    }
    return `${a.direction === 'ABOVE' ? '+' : '-'}${a.targetValue}%`;
  }

  openEditAlert(a: PriceAlert): void {
    const market = this.resolveAlertMarket(a);
    this.alertDrawerExistingAlert.set(a);
    this.alertDrawerSymbol.set(a.symbol);
    this.alertDrawerName.set(a.assetName ?? a.symbol);
    this.alertDrawerAssetType.set(
      a.assetType === 'BIST' ? 'BIST' : a.assetType === 'CRYPTO' ? 'CRYPTO' : 'METAL',
    );
    this.alertDrawerPrice.set(market.price ?? 0);
    this.alertDrawerCurrency.set(market.currency);
    this.alertDrawerOpen.set(true);
  }

  async togglePauseAlert(a: PriceAlert): Promise<void> {
    try {
      if (a.status === 'PAUSED') {
        await this.priceAlertApi.resume(a.id);
        this.toast.success('Alarm yeniden aktif edildi.');
      } else {
        await this.priceAlertApi.pause(a.id);
        this.toast.success('Alarm duraklatıldı.');
      }
    } catch {
      this.toast.error('İşlem sırasında hata oluştu.');
    }
  }

  // ── Add modal: tüm katalog (kullanıcının listesinde olmayanlar) ──────
  // ── Lifecycle ─────────────────────────────────────────────────────────
  constructor() {
    // Aktif watchlist id boşsa backend yüklenince varsayılanı set et.
    effect(() => {
      const lists = this.watchlists();
      const requested = this.requestedWatchlistId();
      if (!lists.length) {
        if (this.activeWatchlistId()) this.activeWatchlistId.set('');
        return;
      }
      const current = this.activeWatchlistId();

      if (requested && lists.some(w => w.id === requested)) {
        if (current !== requested) {
          this.activeWatchlistId.set(requested);
          this.searchQuery.set('');
          this.activeTab.set('bist');
        }
        return;
      }

      if (!current || !lists.some(w => w.id === current)) {
        const def = lists.find(w => w.isDefault) ?? lists[0];
        this.activeWatchlistId.set(def.id);
      }
    });

  }

  async ngOnInit(): Promise<void> {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.requestedWatchlistId.set(params.get('watchlistId') ?? '');
      });

    void this.watchlistApi.reload().then(() => this.subscribeWatchlistAssets());
    void this.priceAlertApi.reload();
    void this.alertsSignalR.connect();

    // Market snapshot (REST)
    this.marketRepo.getSnapshot().subscribe({
      next: snap => {
        this.applySnapshot(
          snap.stocks,
          snap.cryptos,
          snap.usdTry?.rate ?? 0,
          snap.goldSpot ?? null,
        );
      },
      error: () => {
        this.marketSnapshotLoaded.set(true);
      },
    });

    // Canlı stream — bağlantı kurulduktan sonra tick'lere abone ol
    await this.marketSignalR.connect();

    this.marketSignalR.stockTick$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(tick => {
        const next = new Map(this.stockMap());
        next.set(tick.ticker, {
          ticker: tick.ticker,
          companyName: tick.companyName,
          sector: tick.sector,
          price: tick.price,
          change: tick.change,
          changePercent: tick.changePercent,
          volume: tick.volume,
          updatedAt: tick.updatedAt,
        });
        this.stockMap.set(next);
      });

    this.marketSignalR.cryptoTick$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(tick => {
        const next = new Map(this.cryptoMap());
        const existing = next.get(tick.symbol) ?? this.findCryptoByBaseAsset(tick.symbol);
        next.set(tick.symbol, {
          symbol: tick.symbol,
          baseAsset: tick.baseAsset || existing?.baseAsset || tick.symbol.replace(/USDT$/i, ''),
          priceUsdt: tick.priceUsdt,
          priceTry: tick.priceTry,
          changePercent1h: tick.changePercent1h,
          changePercent4h: tick.changePercent4h ?? existing?.changePercent4h ?? null,
          changePercent24h: tick.changePercent24h,
          marketCapUsdt: existing?.marketCapUsdt ?? null,
          circulatingSupply: existing?.circulatingSupply ?? null,
          totalSupply: existing?.totalSupply ?? null,
          network: existing?.network ?? null,
          volume24h: tick.volume24h,
          trySource: existing?.trySource ?? '',
          updatedAt: tick.updatedAt,
        });
        this.cryptoMap.set(next);
      });

    this.marketSignalR.forexTick$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(tick => {
        if (tick.pair?.toUpperCase() === 'USDTRY' && tick.rate > 0) {
          this.usdTryRate.set(tick.rate);
        }
      });

    this.marketSignalR.goldTick$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(tick => {
        this.goldSpot.set({
          ounceUsd: tick.ounceUsd,
          ounceTry: tick.ounceTry,
          gramUsd: tick.gramUsd,
          gramTry: tick.gramTry,
          priceQuality: tick.priceQuality,
          updatedAt: tick.updatedAt,
        });
      });

    // İzleme listesi yüklenince sembollere abone ol
  }

  async ngOnDestroy(): Promise<void> {
    // Markets da aynı repository'yi paylaşıyor; kapatmıyoruz.
  }

  // ── Handlers ─────────────────────────────────────────────────────────
  private async subscribeWatchlistAssets(): Promise<void> {
    const allItems = this.watchlists().flatMap(watchlist =>
      this.watchlistApi.itemsInWatchlist(watchlist.id),
    );
    const stockTickers = [
      ...new Set(
        allItems
          .filter(item => item.assetType === 'BIST')
          .map(item => this.toBistTicker(item.symbol))
          .filter(Boolean),
      ),
    ];
    const cryptoSymbols = [
      ...new Set(
        allItems
          .filter(item => item.assetType === 'CRYPTO')
          .map(item => this.toCryptoStreamSymbol(item.symbol))
          .filter(Boolean),
      ),
    ];

    if (stockTickers.length) await this.marketSignalR.subscribeToStocks(stockTickers);
    if (cryptoSymbols.length) await this.marketSignalR.subscribeToCryptos(cryptoSymbols);
    // Gold and USD/TRY ticks are broadcast to all market hub clients, so metals
    // update through goldTick$/forexTick$ without a symbol group subscription.
  }

  private applySnapshot(
    stocks: MarketStockPrice[],
    cryptos: MarketCryptoPrice[],
    usdTry: number,
    goldSpot: MarketGoldPrice | null,
  ): void {
    const sMap = new Map<string, MarketStockPrice>();
    for (const s of stocks) sMap.set(s.ticker, s);
    this.stockMap.set(sMap);

    const cMap = new Map<string, MarketCryptoPrice>();
    for (const c of cryptos) cMap.set(c.symbol, c);
    this.cryptoMap.set(cMap);

    this.usdTryRate.set(usdTry);
    this.goldSpot.set(goldSpot);
    this.marketSnapshotLoaded.set(true);
  }

  private findStockBySymbol(symbol: string): MarketStockPrice | undefined {
    const upper = (symbol || '').toUpperCase();
    if (!upper) return undefined;
    return (
      this.stockMap().get(upper) ??
      this.stockMap().get(`${upper}.IS`) ??
      [...this.stockMap().values()].find(stock => {
        const ticker = stock.ticker.toUpperCase();
        return ticker === upper || ticker === `${upper}.IS`;
      })
    );
  }

  private findCryptoByBaseAsset(symbol: string): MarketCryptoPrice | undefined {
    // Symbol 'BTCUSDT' olabileceği gibi 'BTC' de olabilir; eşleştirmeye çalış.
    const upper = (symbol || '').toUpperCase();
    if (!upper) return undefined;
    // 1) Doğrudan Binance sembolü (BTCUSDT → BTCUSDT)
    const direct = this.cryptoMap().get(upper);
    if (direct) return direct;
    // 2) baseAsset eşlemesi (BTC → Binance'te "BTCUSDT" olan kaydı bul)
    for (const c of this.cryptoMap().values()) {
      if (c.baseAsset?.toUpperCase() === upper) return c;
    }
    // 3) Son çare: BTC → BTCUSDT lookup
    const withUsdt = this.cryptoMap().get(upper + 'USDT');
    if (withUsdt) return withUsdt;
    return undefined;
  }

  private toBistTicker(symbol: string): string {
    const upper = (symbol || '').toUpperCase();
    if (!upper) return '';
    return upper.endsWith('.IS') ? upper : `${upper}.IS`;
  }

  private toCryptoStreamSymbol(symbol: string): string {
    const upper = (symbol || '').toUpperCase();
    if (!upper) return '';
    return upper.endsWith('USDT') ? upper : `${upper}USDT`;
  }

  private resolveMetalMarket(
    symbol: string,
  ): { price: number; currency: 'TRY' | 'USD'; updatedAt: string } {
    const upper = (symbol || '').trim().toUpperCase();
    const gold = this.goldSpot();
    const usdTryRate = this.usdTryRate();

    if (upper === 'XAU' && gold) {
      if (gold.gramTry > 0) {
        return {
          price: gold.gramTry,
          currency: 'TRY',
          updatedAt: gold.updatedAt,
        };
      }

      if (gold.gramUsd > 0) {
        return {
          price: usdTryRate > 0 ? gold.gramUsd * usdTryRate : gold.gramUsd,
          currency: usdTryRate > 0 ? 'TRY' : 'USD',
          updatedAt: gold.updatedAt,
        };
      }
    }

    return {
      price: 0,
      currency: 'TRY',
      updatedAt: gold?.updatedAt ?? '',
    };
  }

  private computeProgress(price: number, target: number, direction: number): number {
    if (price <= 0 || target <= 0) return 0;
    if (direction > 0 && price >= target) return 100;
    if (direction < 0 && price <= target) return 100;
    const total = Math.abs(target - price) + Math.abs(target * 0.1);
    if (total <= 0) return 0;
    const done = total - Math.abs(target - price);
    return Math.max(0, Math.min(100, (done / total) * 100));
  }

  // ── Table row events ─────────────────────────────────────────────────
  onRemoveFromTable(symbol: string): void {
    const wlId = this.activeWatchlistId();
    if (!wlId) return;
    void this.watchlistApi.removeItem(wlId, symbol).then(ok => {
      if (ok) this.toast.success(`${symbol} listeden kaldırıldı.`);
    });
  }

  onAlertFromTable(symbol: string): void {
    const item = this.allItems().find(i => i.symbol === symbol);
    if (!item) return;
    this.openAlertDrawerFor(item);
  }

  openAlertDrawerFor(item: EnrichedItem): void {
    this.alertDrawerExistingAlert.set(null);
    this.alertDrawerSymbol.set(item.symbol);
    this.alertDrawerName.set(item.name);
    this.alertDrawerAssetType.set(this.mapCategoryToAssetType(item.category));
    this.alertDrawerPrice.set(item.price);
    this.alertDrawerCurrency.set(item.currency);
    this.alertDrawerOpen.set(true);
  }

  openEditAlertDrawer(row: AlertTargetRow): void {
    this.alertDrawerExistingAlert.set(row.alert);
    this.alertDrawerSymbol.set(row.item.symbol);
    this.alertDrawerName.set(row.item.name);
    this.alertDrawerAssetType.set(this.mapCategoryToAssetType(row.item.category));
    this.alertDrawerPrice.set(row.item.price);
    this.alertDrawerCurrency.set(row.item.currency);
    this.alertDrawerOpen.set(true);
  }

  async deleteAlert(alertId: string): Promise<void> {
    try {
      await this.priceAlertApi.delete(alertId);
      this.toast.success('Alarm silindi.');
    } catch {
      this.toast.error('Alarm silinirken hata oluştu.');
    }
  }

  closeAlertDrawer(): void {
    this.alertDrawerOpen.set(false);
    this.alertDrawerExistingAlert.set(null);
  }

  private mapCategoryToAssetType(cat: WatchlistCategory): AlertAssetType {
    if (cat === 'bist') return 'BIST';
    if (cat === 'crypto') return 'CRYPTO';
    return 'METAL';
  }

  onStockColSortChange(sort: StockColSort | null): void {
    this.stockColSort.set(sort);
    if (!sort) {
      this.sortField.set('rank');
      this.sortDirection.set('asc');
      return;
    }
    const map: Record<StockColSort['col'], SortField> = {
      price: 'price',
      change: 'changePercent',
      volume: 'volume',
    };
    this.sortField.set(map[sort.col]);
    this.sortDirection.set(sort.dir);
  }

  onCryptoColSortChange(sort: CryptoColSort | null): void {
    this.cryptoColSort.set(sort);
    if (!sort) {
      this.sortField.set('rank');
      this.sortDirection.set('asc');
      return;
    }
    const map: Record<CryptoColSort['col'], SortField> = {
      price: 'price',
      change1h: 'changePercent',
      change4h: 'changePercent',
      change24h: 'changePercent',
      marketCap: 'marketCap',
      volume: 'volume',
    };
    this.sortField.set(map[sort.col]);
    this.sortDirection.set(sort.dir);
  }

  // ── Watchlist CRUD ────────────────────────────────────────────────────
  selectWatchlist(id: string): void {
    this.activeWatchlistId.set(id);
    this.searchQuery.set('');
    this.activeTab.set('bist');
    this.showWlActionsMenu.set(false);
  }

  async createWatchlist(): Promise<void> {
    const name = this.newWlName().trim();
    if (!name || this.busy()) {
      this.showNewWlModal.set(false);
      return;
    }
    this.busy.set(true);
    try {
      const wl = await this.watchlistApi.createWatchlist({ name });
      this.activeWatchlistId.set(wl.id);
      this.newWlName.set('');
      this.showNewWlModal.set(false);
    } catch {
      this.toast.error('Liste oluşturulamadı.');
    } finally {
      this.busy.set(false);
    }
  }

  async renameWatchlist(): Promise<void> {
    const name = this.newWlName().trim();
    const id = this.activeWatchlistId();
    if (!name || !id || this.busy()) return;
    this.busy.set(true);
    try {
      await this.watchlistApi.renameWatchlist(id, { name });
      this.newWlName.set('');
      this.showRenameWlModal.set(false);
      this.showWlActionsMenu.set(false);
    } catch {
      this.toast.error('Liste yeniden adlandırılamadı.');
    } finally {
      this.busy.set(false);
    }
  }

  async deleteWatchlist(): Promise<void> {
    const id = this.activeWatchlistId();
    const lists = this.watchlists();
    if (!id || lists.length <= 1 || this.busy()) return;
    const target = lists.find(w => w.id === id);
    if (target?.isDefault) {
      this.toast.warning('Varsayılan liste silinemez.');
      return;
    }
    this.busy.set(true);
    try {
      const res = await this.watchlistApi.deleteWatchlist(id);
      if (!res.ok) {
        this.toast.error('Liste silinemedi.');
        return;
      }
      const next = lists.find(w => w.id !== id);
      if (next) this.activeWatchlistId.set(next.id);
      this.showWlActionsMenu.set(false);
    } finally {
      this.busy.set(false);
    }
  }

  openRenameWlModal(): void {
    this.newWlName.set(this.activeWatchlist()?.name ?? '');
    this.showRenameWlModal.set(true);
    this.showWlActionsMenu.set(false);
  }

  // ── Tab + sort ───────────────────────────────────────────────────────
  setTab(tab: MainTab): void {
    this.activeTab.set(tab);
    this.searchQuery.set('');
  }

  sortBy(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDirection.update(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set(field === 'rank' ? 'asc' : 'desc');
    }
  }

  isSortActive(field: SortField): boolean {
    return this.sortField() === field;
  }

  // ── Add modal ────────────────────────────────────────────────────────
  openAddModal(): void {
    const tab = this.activeTab();
    this.addModalAssetType.set(
      tab === 'crypto'
        ? 'Crypto'
        : tab === 'metal'
          ? 'PreciousMetal'
          : 'BIST',
    );
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
  }

  onAddModalAssetTypeChange(type: AddModalAssetType): void {
    this.addModalAssetType.set(type);
  }

  async onAddAssetSelected(asset: SelectedAsset): Promise<void> {
    const wlId = this.activeWatchlistId();
    if (!wlId) return;
    const assetType = this.mapSelectedAssetTypeToWatchlistAssetType(asset.assetType);
    if (!assetType) {
      this.toast.error('Seçilen varlık tipi henüz desteklenmiyor.');
      return;
    }

    try {
      await this.watchlistApi.addItem(wlId, asset.symbol, assetType, asset.name);
      await this.subscribeWatchlistAssets();
      this.toast.success(`${asset.symbol} listeye eklendi.`);
      this.closeAddModal();
    } catch {
      this.toast.error(`${asset.symbol} eklenemedi.`);
    }
  }

  // ── Avatar / format helpers ──────────────────────────────────────────
  private mapSelectedAssetTypeToWatchlistAssetType(
    assetType: string,
  ): WatchlistAssetType | null {
    switch (assetType) {
      case 'BIST':
        return 'BIST';
      case 'Crypto':
        return 'CRYPTO';
      case 'PreciousMetal':
        return 'METAL';
      default:
        return null;
    }
  }

  private resolveAlertMarket(alert: PriceAlert): {
    price: number | null;
    currency: 'TRY' | 'USD';
    updatedAt: string;
  } {
    if (alert.assetType === 'BIST') {
      const stock = this.findStockBySymbol(alert.symbol);
      return {
        price: stock?.price ?? null,
        currency: 'TRY',
        updatedAt: stock?.updatedAt ?? '',
      };
    }

    if (alert.assetType === 'CRYPTO') {
      const crypto = this.findCryptoByBaseAsset(alert.symbol);
      const price =
        alert.currency === 'TRY'
          ? crypto?.priceTry ??
            (crypto?.priceUsdt && this.usdTryRate() > 0
              ? crypto.priceUsdt * this.usdTryRate()
              : null)
          : crypto?.priceUsdt ?? null;
      return {
        price,
        currency: alert.currency === 'TRY' ? 'TRY' : 'USD',
        updatedAt: crypto?.updatedAt ?? '',
      };
    }

    const gold = this.goldSpot();
    const usdTryRate = this.usdTryRate();
    const metalPrice =
      alert.currency === 'USD'
        ? gold?.gramUsd ??
          (gold?.gramTry && usdTryRate > 0 ? gold.gramTry / usdTryRate : null)
        : gold?.gramTry ??
          (gold?.gramUsd && usdTryRate > 0 ? gold.gramUsd * usdTryRate : null);
    return {
      price: metalPrice && metalPrice > 0 ? metalPrice : null,
      currency: alert.currency === 'USD' ? 'USD' : 'TRY',
      updatedAt: gold?.updatedAt ?? '',
    };
  }

  getAlertCurrentPriceLabel(alert: PriceAlert): string {
    const market = this.resolveAlertMarket(alert);
    if (!market.price || market.price <= 0) {
      return 'Veri bekleniyor';
    }
    return this.formatPrice(market.price, market.currency);
  }

  getAlertDistanceLabel(alert: PriceAlert): string {
    if (alert.status === 'TRIGGERED') {
      return 'Hedefe ulaştı';
    }

    const market = this.resolveAlertMarket(alert);
    if (!market.price || market.price <= 0) {
      return 'Mesafe hesaplanamıyor';
    }

    if (alert.kind === 'PRICE') {
      const diffPct = ((alert.targetValue - market.price) / market.price) * 100;
      return `%${Math.abs(diffPct).toFixed(2)} ${diffPct >= 0 ? 'kaldı' : 'aşıldı'}`;
    }

    const baseline = alert.baselinePrice ?? 0;
    if (baseline <= 0) {
      return 'Mesafe hesaplanamıyor';
    }

    const currentChange = ((market.price - baseline) / baseline) * 100;
    const target =
      alert.direction === 'ABOVE' ? Math.abs(alert.targetValue) : -Math.abs(alert.targetValue);
    const remaining = target - currentChange;
    return `%${Math.abs(remaining).toFixed(2)} ${remaining >= 0 ? 'kaldı' : 'aşıldı'}`;
  }

  getAlertProgress(alert: PriceAlert): number {
    if (alert.status === 'TRIGGERED') return 100;

    const market = this.resolveAlertMarket(alert);
    if (!market.price || market.price <= 0) return 0;

    if (alert.kind === 'PRICE') {
      return this.computeProgress(
        market.price,
        alert.targetValue,
        alert.direction === 'ABOVE' ? 1 : -1,
      );
    }

    const baseline = alert.baselinePrice ?? 0;
    const targetAbs = Math.abs(alert.targetValue);
    if (baseline <= 0 || targetAbs <= 0) return 0;

    const currentChange = ((market.price - baseline) / baseline) * 100;
    const covered =
      alert.direction === 'ABOVE'
        ? currentChange / targetAbs
        : (-currentChange) / targetAbs;
    return Math.max(0, Math.min(100, covered * 100));
  }

  getAlertWatchlistName(alert: PriceAlert): string {
    if (!alert.watchlistId) {
      return 'Bağımsız alarm';
    }
    return (
      this.watchlists().find(watchlist => watchlist.id === alert.watchlistId)?.name ??
      'İzleme listesi'
    );
  }

  getAlertRepeatLabel(alert: PriceAlert): string {
    switch (alert.repeat) {
      case 'RECURRING':
        return 'Tekrarlı';
      case 'AUTO_DELETE':
        return 'Otomatik sil';
      case 'ONCE':
      default:
        return 'Tek seferlik';
    }
  }

  getAlertChannelLabels(alert: PriceAlert): string[] {
    return alert.channels.map(channel =>
      channel === 'EMAIL' ? 'E-posta' : 'Uygulama içi',
    );
  }

  formatAlertTimestamp(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getAlertCategory(alert: PriceAlert): WatchlistCategory {
    if (alert.assetType === 'CRYPTO') return 'crypto';
    if (alert.assetType === 'METAL') return 'metal';
    return 'bist';
  }

  getAvatarColor(symbol: string): string {
    const colors = [
      '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444',
      '#f59e0b', '#10b981', '#06b6d4', '#6366f1',
    ];
    let h = 0;
    for (const c of symbol) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return colors[h % colors.length];
  }

  getCategoryIcon(cat: WatchlistCategory): string {
    if (cat === 'crypto') return 'fa-bitcoin-sign';
    if (cat === 'metal') return 'fa-gem';
    return 'fa-chart-column';
  }

  getCategoryLabel(cat: WatchlistCategory): string {
    if (cat === 'crypto') return 'Kripto';
    if (cat === 'metal') return 'Değerli Maden';
    return 'BIST';
  }

  getCategoryCount(cat: WatchlistCategory): number {
    return this.categoryCount()[cat];
  }

  formatPrice(price: number, currency: string): string {
    const abs = Math.abs(price);
    const decimals = abs < 0.01 ? 6 : abs < 1 ? 4 : abs < 100 ? 4 : 2;
    const formatted = new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(price);
    return currency ? `${formatted} ${currency}` : formatted;
  }

  formatPercent(pct: number): string {
    const prefix = pct >= 0 ? '+' : '';
    return `${prefix}${Math.abs(pct).toFixed(2)}%`;
  }

  private toMoverItem(item: EnrichedItem): MoverListItem {
    return {
      avatarFallback: item.symbol.charAt(0),
      avatarColor: CATEGORY_COLORS[item.category],
      label: item.symbol,
      value: this.formatPrice(item.price, item.currency),
      change: item.changePercent,
    };
  }

  // ── Sparkline ────────────────────────────────────────────────────────
  getSparklinePoints(data: number[] | undefined, w = 160, h = 48): string {
    if (!data || data.length < 2) return '';
    const mn = Math.min(...data), mx = Math.max(...data), range = mx - mn || 1;
    const pad = 3;
    return data
      .map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - pad - ((v - mn) / range) * (h - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  getSparklineAreaPoints(data: number[] | undefined, w = 160, h = 48): string {
    if (!data || data.length < 2) return '';
    const line = this.getSparklinePoints(data, w, h);
    const lastX = w.toFixed(1);
    return `0,${h} ${line} ${lastX},${h}`;
  }
}
