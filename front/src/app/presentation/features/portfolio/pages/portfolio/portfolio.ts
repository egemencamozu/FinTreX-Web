import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MarketDataRepository } from '../../../../../core/interfaces/market-data.repository';
import { PortfolioRepository } from '../../../../../core/interfaces/portfolio.repository';
import { Portfolio as PortfolioModel } from '../../../../../core/models/portfolio.model';
import { PortfolioAsset } from '../../../../../core/models/asset.model';
import { HoldingsCardComponent, CardViewDirective } from '../../../../shared/components/holdings-card/holdings-card.component';
import { SegmentedControlComponent, SegmentedOption } from '../../../../shared/components/segmented-control/segmented-control.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { LineChartComponent, LineChartInput } from '../../../../shared/components/charts/line-chart/line-chart.component';
import { DoughnutChartComponent, DoughnutItem } from '../../../../shared/components/charts/doughnut-chart/doughnut-chart.component';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import { MarketAssetCellComponent } from '../../components/market-asset-cell/market-asset-cell.component';
import { AssetSelectModalComponent, SelectedAsset } from '../../components/asset-select-modal/asset-select-modal.component';
import { catchError, finalize, forkJoin, of, Subject, takeUntil } from 'rxjs';
import { AlertService } from '../../../../../core/services/alert.service';
import { MarketDataSignalRService } from '../../../../../core/services/market-data-signalr.service';
import { AssetType } from '../../../../../core/enums/asset-type.enum';
import { PortfolioHistory } from '../../../../../core/models/portfolio-history.model';
import { PortfolioOverview } from '../../../../../core/models/portfolio-overview.model';
import { PortfolioTransaction, TransactionType } from '../../../../../core/models/transaction.model';

function cssVar(name: string): string {
  if (typeof window === 'undefined') return '';
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || '';
}

type SortDir = 'asc' | 'desc';
type AssetSortCol = 'price' | 'change1h' | 'change24h' | 'change4h' | 'holdings' | 'avgBuyPrice' | 'profitLoss';
type TxSortCol = 'date' | 'price' | 'amount' | 'total';
type AssetsPanelView = 'assets' | 'transactions';

interface AssetLiveData {
  change1h: number | null;
  change24h: number | null;
  change4h: number | null;
}

interface AggregatedOverviewAsset {
  symbol: string;
  assetName: string;
  assetType: AssetType;
  quantity: number;
  totalCost: number;
  totalValue: number;
  acquiredAtUtc: string;
  createdAtUtc: string;
  currentValueUpdatedAtUtc?: string;
  notes?: string;
}

interface AssetColSort {
  col: AssetSortCol;
  dir: SortDir;
}

interface TxColSort {
  col: TxSortCol;
  dir: SortDir;
}

export interface TransactionRow {
  id: number;
  symbol: string;
  assetName: string;
  assetType: AssetType;
  type: TransactionType;
  currency: string;
  quantity: number;
  price: number;
  fees?: number;
  total: number;
  notes?: string;
  date: string;
}

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [
    CommonModule,
    HoldingsCardComponent, CardViewDirective,
    SegmentedControlComponent, LineChartComponent, DoughnutChartComponent,
    KpiCardComponent, MarketAssetCellComponent,
    AssetSelectModalComponent, PaginatorComponent,
  ],
  templateUrl: './portfolio.html',
  styleUrl: './portfolio.scss',
})
export class Portfolio implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly portfolioRepo = inject(PortfolioRepository);
  private readonly marketDataRepository = inject(MarketDataRepository);
  private readonly alertService = inject(AlertService);
  private readonly marketDataSignalR = inject(MarketDataSignalRService);
  private readonly destroy$ = new Subject<void>();
  private readonly historyDebounceMs = 4000;
  private readonly historyMinRefreshGapMs = 15000;
  private historyDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private historyRefreshInFlight = false;
  private historyRefreshPending = false;
  private historyForceRefreshPending = false;
  private lastHistoryRefreshAt = 0;
  private overviewRequestSeq = 0;
  private allOverviewsRequestSeq = 0;
  private overviewHistoryRequestSeq = 0;

  private readonly profitColor = cssVar('--chart-profit') || '#4f6ef7';
  private readonly lossColor = cssVar('--chart-loss');
  private readonly lossAlpha = this.lossColor + '33';

  readonly isLoading = signal<boolean>(true);
  readonly clientPortfolioOwnerId = signal<string | null>(null);
  readonly isReadOnly = computed(() => this.clientPortfolioOwnerId() !== null);
  readonly portfolios = signal<PortfolioModel[]>([]);
  readonly usdTryRate = signal<number>(0);
  readonly isRateReady = computed(() => this.historyCurrency() === 'TRY' || this.usdTryRate() > 0);
  readonly overview = signal<PortfolioOverview | null>(null);
  readonly allOverviews = signal<PortfolioOverview[]>([]);
  readonly allRawTransactions = signal<PortfolioTransaction[]>([]);
  readonly activePortfolioIndex = signal<number>(0);
  readonly requestedPortfolioId = signal<number | null>(null);
  readonly activeRange = signal<string>('30d');
  readonly historyCurrency = signal<'TRY' | 'USD'>('TRY');
  readonly activeChartView = signal<'history' | 'performance'>('history');
  readonly overviewHistoryChartData = signal<LineChartInput>(this.buildEmptyHistoryChart());
  readonly overviewDoughnutFilter = signal<'asset' | 'portfolio'>('asset');

  readonly showNewPortfolioModal = signal<boolean>(false);
  readonly showAddAssetModal = signal<boolean>(false);
  readonly editingAsset = signal<PortfolioAsset | null>(null);
  readonly isPortfolioDropdownOpen = signal<boolean>(false);
  readonly isActionsMenuOpen = signal<boolean>(false);
  readonly showRenameModal = signal<boolean>(false);
  readonly isPrivacyMode = signal<boolean>(false);
  readonly renameValue = signal<string>('');
  readonly isOverviewSelected = signal<boolean>(false);
  readonly performerFilter = signal<string>('all');
  readonly assetViewFilter = signal<string>('all');
  readonly assetColSort = signal<AssetColSort | null>({ col: 'profitLoss', dir: 'desc' });
  readonly assetsPanelView = signal<AssetsPanelView>('assets');
  readonly txColSort = signal<TxColSort | null>({ col: 'date', dir: 'desc' });

  readonly ASSETS_PAGE_SIZE = 20;
  readonly assetsPage = signal(1);
  readonly txPage = signal(1);

  readonly rawTransactions = signal<PortfolioTransaction[]>([]);
  readonly liveChanges = signal<Map<string, AssetLiveData>>(new Map());

  readonly modalAssetType = signal<string>('BIST');
  readonly modalCurrency = signal<string>('TRY');
  readonly showAssetSelectModal = signal<boolean>(false);
  readonly modalSelectedSymbol = signal<string>('');
  readonly modalSelectedName = signal<string>('');

  readonly assetTypeOptions = [
    { value: 'BIST',          label: 'BIST',          icon: 'fa-solid fa-building-columns' },
    { value: 'Crypto',        label: 'Kripto',         icon: 'fa-brands fa-bitcoin' },
    { value: 'PreciousMetal', label: 'Değerli Metal',  icon: 'fa-solid fa-gem' },
  ];

  readonly currentPortfolio = computed(() =>
    this.portfolios().length > this.activePortfolioIndex()
      ? this.portfolios()[this.activePortfolioIndex()]
      : null
  );

  private convertToDisplayCurrency(amount: number, assetCurrency: string): number {
    const target = this.historyCurrency();
    const rate = this.usdTryRate();
    const from = assetCurrency?.toUpperCase();
    if (from === target) return amount;
    if (rate <= 0) return amount;
    if (from === 'USD' && target === 'TRY') return amount * rate;
    if (from === 'TRY' && target === 'USD') return amount / rate;
    return amount;
  }

  readonly totalValue = computed(() => {
    const assets = this.currentPortfolio()?.assets ?? [];
    return assets.reduce((sum, a) => {
      const raw = a.quantity * (a.currentValue ?? a.averageCost);
      return sum + this.convertToDisplayCurrency(raw, a.currency);
    }, 0);
  });

  readonly totalCost = computed(() => {
    const assets = this.currentPortfolio()?.assets ?? [];
    return assets.reduce((sum, a) => {
      const raw = a.quantity * a.averageCost;
      return sum + this.convertToDisplayCurrency(raw, a.currency);
    }, 0);
  });

  readonly totalPnL = computed(() => this.totalValue() - this.totalCost());

  readonly totalPnLPercent = computed(() => {
    const cost = this.totalCost();
    return cost > 0 ? (this.totalPnL() / cost) * 100 : 0;
  });

  readonly allPortfolioAssets = computed<PortfolioAsset[]>(() =>
    this.portfolios().flatMap(pf => pf.assets ?? [])
  );

  readonly aggregatedOverviewAssets = computed<PortfolioAsset[]>(() => {
    const targetCurrency = this.historyCurrency();
    const grouped = new Map<string, AggregatedOverviewAsset>();

    for (const asset of this.allPortfolioAssets()) {
      const key = this.buildOverviewAssetKey(asset);
      const convertedCost = this.convertToDisplayCurrency(asset.quantity * asset.averageCost, asset.currency);
      const convertedValue = this.convertToDisplayCurrency(
        asset.quantity * (asset.currentValue ?? asset.averageCost),
        asset.currency
      );
      const existing = grouped.get(key);

      if (existing) {
        existing.quantity += asset.quantity;
        existing.totalCost += convertedCost;
        existing.totalValue += convertedValue;
        existing.assetName = existing.assetName || asset.assetName;
        existing.notes = existing.notes || asset.notes;

        if (asset.acquiredAtUtc < existing.acquiredAtUtc) {
          existing.acquiredAtUtc = asset.acquiredAtUtc;
        }

        if (asset.createdAtUtc < existing.createdAtUtc) {
          existing.createdAtUtc = asset.createdAtUtc;
        }

        if (
          asset.currentValueUpdatedAtUtc &&
          (!existing.currentValueUpdatedAtUtc || asset.currentValueUpdatedAtUtc > existing.currentValueUpdatedAtUtc)
        ) {
          existing.currentValueUpdatedAtUtc = asset.currentValueUpdatedAtUtc;
        }

        continue;
      }

      grouped.set(key, {
        symbol: asset.symbol,
        assetName: asset.assetName,
        assetType: asset.assetType,
        quantity: asset.quantity,
        totalCost: convertedCost,
        totalValue: convertedValue,
        acquiredAtUtc: asset.acquiredAtUtc,
        createdAtUtc: asset.createdAtUtc,
        currentValueUpdatedAtUtc: asset.currentValueUpdatedAtUtc,
        notes: asset.notes,
      });
    }

    return [...grouped.entries()]
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([_, asset], index) => ({
        id: -(index + 1),
        portfolioId: 0,
        symbol: asset.symbol,
        assetName: asset.assetName,
        assetType: asset.assetType,
        quantity: asset.quantity,
        averageCost: asset.quantity > 0 ? asset.totalCost / asset.quantity : 0,
        currency: targetCurrency,
        currentValue: asset.quantity > 0 ? asset.totalValue / asset.quantity : undefined,
        currentValueUpdatedAtUtc: asset.currentValueUpdatedAtUtc,
        acquiredAtUtc: asset.acquiredAtUtc,
        notes: asset.notes,
        createdAtUtc: asset.createdAtUtc,
      }));
  });

  readonly overviewTotalValue = computed(() =>
    this.aggregatedOverviewAssets().reduce((sum, a) => {
      const raw = a.quantity * (a.currentValue ?? a.averageCost);
      return sum + this.convertToDisplayCurrency(raw, a.currency);
    }, 0)
  );

  readonly overviewTotalCost = computed(() =>
    this.aggregatedOverviewAssets().reduce((sum, a) => {
      const raw = a.quantity * a.averageCost;
      return sum + this.convertToDisplayCurrency(raw, a.currency);
    }, 0)
  );

  readonly overviewTotalPnL = computed(() => this.overviewTotalValue() - this.overviewTotalCost());

  readonly overviewTotalPnLPercent = computed(() => {
    const cost = this.overviewTotalCost();
    return cost > 0 ? (this.overviewTotalPnL() / cost) * 100 : 0;
  });

  readonly overviewFilteredAssets = computed<PortfolioAsset[]>(() => {
    const filter = this.assetViewFilter();
    const assets = this.aggregatedOverviewAssets();
    return filter === 'all' ? assets : assets.filter(a => a.assetType === filter);
  });

  readonly overviewSortedAssets = computed<PortfolioAsset[]>(() => {
    const assets = [...this.overviewFilteredAssets()];
    const colSort = this.assetColSort();
    if (!colSort) return assets;

    const metric = (asset: PortfolioAsset): number => {
      switch (colSort.col) {
        case 'price':       return this.getAssetUnitPrice(asset);
        case 'change1h':
        case 'change24h':
        case 'change4h':    return this.liveChanges().get(asset.symbol)?.[colSort.col] ?? 0;
        case 'holdings':    return this.getAssetHoldingValue(asset);
        case 'avgBuyPrice': return this.getAssetAverageCost(asset);
        case 'profitLoss':  return this.getAssetProfitLoss(asset);
        default: return 0;
      }
    };

    assets.sort((l, r) => {
      const lv = metric(l), rv = metric(r);
      return colSort.dir === 'asc' ? lv - rv : rv - lv;
    });
    return assets;
  });

  private overviewPerformerList = computed(() => {
    const filter = this.performerFilter();
    const assets = this.aggregatedOverviewAssets();
    const filtered = filter === 'all' ? assets : assets.filter(a => a.assetType === filter);
    return filtered.map(a => {
      const current = a.currentValue ?? a.averageCost;
      const changePercent = a.averageCost > 0 ? ((current - a.averageCost) / a.averageCost) * 100 : 0;
      const rawValue = Math.abs((current - a.averageCost) * a.quantity);
      const value = this.convertToDisplayCurrency(rawValue, a.currency);
      return { symbol: a.symbol, assetType: a.assetType as string, changePercent, value };
    });
  });

  readonly overviewBestPerformer = computed<{ symbol: string; value: number; change: number; assetType: string } | null>(() => {
    const list = this.overviewPerformerList();
    if (!list.length) return null;
    const best = list.reduce((b, c) => c.changePercent > b.changePercent ? c : b);
    return { symbol: best.symbol, value: best.value, change: best.changePercent, assetType: best.assetType };
  });

  readonly overviewWorstPerformer = computed<{ symbol: string; value: number; change: number; assetType: string } | null>(() => {
    const list = this.overviewPerformerList();
    if (!list.length) return null;
    const worst = list.reduce((w, c) => c.changePercent < w.changePercent ? c : w);
    return { symbol: worst.symbol, value: worst.value, change: worst.changePercent, assetType: worst.assetType };
  });

  readonly overviewAllTransactions = computed<TransactionRow[]>(() => {
    const rows = this.allRawTransactions().map(t => ({
      id:        t.id,
      symbol:    t.symbol,
      assetName: t.assetName,
      assetType: t.assetType,
      type:      t.type,
      currency:  t.currency,
      quantity:  t.quantity,
      price:     t.price,
      fees:      t.fees,
      total:     t.price * t.quantity,
      notes:     t.notes,
      date:      t.executedAtUtc,
    }));
    const filteredRows = rows.filter(tx => this.matchesAssetViewFilter(tx.assetType));
    const colSort = this.txColSort();
    if (!colSort) return filteredRows;
    const metric = (tx: TransactionRow): number => {
      switch (colSort.col) {
        case 'date':   return new Date(tx.date).getTime();
        case 'price':  return tx.price;
        case 'amount': return tx.quantity;
        case 'total':  return tx.total;
        default: return 0;
      }
    };
    return [...filteredRows].sort((l, r) => {
      const lv = metric(l), rv = metric(r);
      return colSort.dir === 'asc' ? lv - rv : rv - lv;
    });
  });

  private readonly currentPortfolioPerformerList = computed(() => {
    const filter = this.performerFilter();
    const assets = this.currentPortfolio()?.assets ?? [];
    const filtered = filter === 'all' ? assets : assets.filter(a => a.assetType === filter);
    return filtered.map(a => {
      const current = a.currentValue ?? a.averageCost;
      const changePercent = a.averageCost > 0 ? ((current - a.averageCost) / a.averageCost) * 100 : 0;
      const rawValue = Math.abs((current - a.averageCost) * a.quantity);
      const value = this.convertToDisplayCurrency(rawValue, a.currency);
      return { symbol: a.symbol, assetType: a.assetType as string, changePercent, value };
    });
  });

  readonly bestPerformer = computed<{ symbol: string; value: number; change: number; assetType: string } | null>(() => {
    const list = this.currentPortfolioPerformerList();
    if (!list.length) return null;
    const best = list.reduce((b, c) => c.changePercent > b.changePercent ? c : b);
    return { symbol: best.symbol, value: best.value, change: best.changePercent, assetType: best.assetType };
  });

  readonly worstPerformer = computed<{ symbol: string; value: number; change: number; assetType: string } | null>(() => {
    const list = this.currentPortfolioPerformerList();
    if (!list.length) return null;
    const worst = list.reduce((w, c) => c.changePercent < w.changePercent ? c : w);
    return { symbol: worst.symbol, value: worst.value, change: worst.changePercent, assetType: worst.assetType };
  });

  readonly chartViewOptions: SegmentedOption[] = [
    { id: 'history',     label: 'Geçmiş' },
    { id: 'performance', label: 'Performans' },
  ];

  readonly overviewDoughnutFilterOptions: SegmentedOption[] = [
    { id: 'asset',     label: 'Varlık' },
    { id: 'portfolio', label: 'Portföy' },
  ];

  readonly rangeOptions: SegmentedOption[] = [
    { id: '24h', label: '24h' },
    { id: '7d',  label: '7d' },
    { id: '30d', label: '30d' },
    { id: '90d', label: '90d' },
    { id: 'all', label: 'Tümü' },
  ];

  readonly historyCurrencyOptions: SegmentedOption[] = [
    { id: 'TRY', label: 'TRY' },
    { id: 'USD', label: 'USD' },
  ];

  readonly performerFilterOptions: SegmentedOption[] = [
    { id: 'all',           label: 'Tümü' },
    { id: 'BIST',          label: 'BIST' },
    { id: 'Crypto',        label: 'Kripto' },
    { id: 'PreciousMetal', label: 'Değerli Metal' },
  ];

  readonly assetViewFilterOptions: SegmentedOption[] = [
    { id: 'all',           label: 'Tüm Varlıklar' },
    { id: 'BIST',          label: 'BIST' },
    { id: 'Crypto',        label: 'Kripto' },
    { id: 'PreciousMetal', label: 'Değerli Metal' },
  ];

  readonly assetsPanelViewOptions: SegmentedOption[] = [
    { id: 'assets',       label: 'Varlıklarım' },
    { id: 'transactions', label: 'İşlemler' },
  ];

  readonly filteredAssets = computed(() => {
    const assets = this.currentPortfolio()?.assets ?? [];
    const filter = this.assetViewFilter();
    if (filter === 'all') return assets;
    return assets.filter(a => a.assetType === filter);
  });

  readonly showIntradayColumns  = computed(() => this.assetViewFilter() === 'Crypto');
  readonly showSingleChangeColumn = computed(() => !this.showIntradayColumns());

  readonly sortedAssets = computed(() => {
    const assets = [...this.filteredAssets()];
    const colSort = this.assetColSort();
    if (!colSort) return assets;

    const metric = (asset: PortfolioAsset): number => {
      switch (colSort.col) {
        case 'price':    return this.getAssetUnitPrice(asset);
        case 'change1h':
        case 'change24h':
        case 'change4h': return this.liveChanges().get(asset.symbol)?.[colSort.col] ?? 0;
        case 'holdings': return this.getAssetHoldingValue(asset);
        case 'avgBuyPrice': return this.getAssetAverageCost(asset);
        case 'profitLoss':  return this.getAssetProfitLoss(asset);
        default: return 0;
      }
    };

    assets.sort((l, r) => {
      const lv = metric(l);
      const rv = metric(r);
      return colSort.dir === 'asc' ? lv - rv : rv - lv;
    });

    return assets;
  });

  readonly transactions = computed<TransactionRow[]>(() =>
    this.rawTransactions().map(t => ({
      id:        t.id,
      symbol:    t.symbol,
      assetName: t.assetName,
      assetType: t.assetType,
      type:      t.type,
      currency:  t.currency,
      quantity:  t.quantity,
      price:     t.price,
      fees:      t.fees,
      total:     t.price * t.quantity,
      notes:     t.notes,
      date:      t.executedAtUtc,
    }))
  );

  readonly filteredTransactions = computed<TransactionRow[]>(() =>
    this.transactions().filter(tx => this.matchesAssetViewFilter(tx.assetType))
  );

  readonly sortedTransactions = computed<TransactionRow[]>(() => {
    const rows = [...this.filteredTransactions()];
    const colSort = this.txColSort();
    if (!colSort) return rows;

    const metric = (tx: TransactionRow): number => {
      switch (colSort.col) {
        case 'date':   return new Date(tx.date).getTime();
        case 'price':  return tx.price;
        case 'amount': return tx.quantity;
        case 'total':  return tx.total;
        default: return 0;
      }
    };

    rows.sort((l, r) => {
      const lv = metric(l);
      const rv = metric(r);
      return colSort.dir === 'asc' ? lv - rv : rv - lv;
    });

    return rows;
  });

  readonly pagedSortedAssets = computed(() => {
    const p = this.assetsPage();
    return this.sortedAssets().slice((p - 1) * this.ASSETS_PAGE_SIZE, p * this.ASSETS_PAGE_SIZE);
  });

  readonly pagedOverviewSortedAssets = computed(() => {
    const p = this.assetsPage();
    return this.overviewSortedAssets().slice((p - 1) * this.ASSETS_PAGE_SIZE, p * this.ASSETS_PAGE_SIZE);
  });

  readonly pagedSortedTransactions = computed(() => {
    const p = this.txPage();
    return this.sortedTransactions().slice((p - 1) * this.ASSETS_PAGE_SIZE, p * this.ASSETS_PAGE_SIZE);
  });

  readonly pagedOverviewAllTransactions = computed(() => {
    const p = this.txPage();
    return this.overviewAllTransactions().slice((p - 1) * this.ASSETS_PAGE_SIZE, p * this.ASSETS_PAGE_SIZE);
  });

  readonly allocationItems = computed<DoughnutItem[]>(() => {
    const assets = this.currentPortfolio()?.assets ?? [];
    if (!assets.length) return [];

    const symbolMap = new Map<string, number>();
    for (const a of assets) {
      const raw = a.quantity * (a.currentValue ?? a.averageCost);
      const val = this.convertToDisplayCurrency(raw, a.currency);
      symbolMap.set(a.symbol, (symbolMap.get(a.symbol) ?? 0) + val);
    }
    const grand = [...symbolMap.values()].reduce((s, v) => s + v, 0);
    if (grand <= 0) return [];
    return [...symbolMap.entries()]
      .map(([label, val]) => ({ label, value: Number(((val / grand) * 100).toFixed(2)) }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  });

  readonly overviewAllocationItems = computed<DoughnutItem[]>(() => {
    const overviews = this.allOverviews();
    if (!overviews.length) return [];

    if (this.overviewDoughnutFilter() === 'portfolio') {
      const nameById = new Map(this.portfolios().map(p => [p.id, p.name]));
      const grand = overviews.reduce((s, ov) => s + ov.totalValue, 0);
      if (grand <= 0) return [];
      return overviews
        .map(ov => ({
          label: nameById.get(ov.portfolioId) ?? `Portföy ${ov.portfolioId}`,
          value: Number(((ov.totalValue / grand) * 100).toFixed(2)),
        }))
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value);
    }

    const symbolMap = new Map<string, number>();
    for (const a of this.aggregatedOverviewAssets()) {
      const raw = a.quantity * (a.currentValue ?? a.averageCost);
      const val = this.convertToDisplayCurrency(raw, a.currency);
      symbolMap.set(a.symbol, (symbolMap.get(a.symbol) ?? 0) + val);
    }
    const grand = [...symbolMap.values()].reduce((s, v) => s + v, 0);
    if (grand <= 0) return [];
    return [...symbolMap.entries()]
      .map(([label, val]) => ({ label, value: Number(((val / grand) * 100).toFixed(2)) }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  });

  readonly historyChartData = signal<LineChartInput>(this.buildEmptyHistoryChart());

  readonly performanceChartData = computed<LineChartInput>(() => {
    const data = this.historyChartData();
    const portfolioSeries = this.toPercentSeries(data.series[0]?.data ?? []);
    return {
      labels: data.labels,
      series: [
        { name: 'Tüm zamanlar kârı', data: portfolioSeries, color: this.profitColor },
      ],
    };
  });

  ngOnInit(): void {
    this.clientPortfolioOwnerId.set(this.route.snapshot.paramMap.get('clientId'));

    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const raw = params.get('portfolioId');
        const id = raw ? Number(raw) : null;
        this.requestedPortfolioId.set(id && Number.isFinite(id) ? id : null);
        this.applyRequestedPortfolio(true);
      });

    this.connectSignalR().then(() => {
      this.route.paramMap
        .pipe(takeUntil(this.destroy$))
        .subscribe(params => {
          const clientId = params.get('clientId');
          if (this.clientPortfolioOwnerId() !== clientId) {
            this.clientPortfolioOwnerId.set(clientId);
            this.resetPortfolioViewState();
          }

          this.loadPortfolios();
        });
    });
  }

  ngOnDestroy(): void {
    this.clearHistoryDebounceTimer();
    this.destroy$.next();
    this.destroy$.complete();
    this.unsubscribeAllAssets();
    this.marketDataSignalR.disconnect();
  }

  private resetPortfolioViewState(): void {
    this.unsubscribeAllAssets();
    this.portfolios.set([]);
    this.overview.set(null);
    this.allOverviews.set([]);
    this.allRawTransactions.set([]);
    this.rawTransactions.set([]);
    this.activePortfolioIndex.set(0);
    this.isOverviewSelected.set(false);
    this.isPortfolioDropdownOpen.set(false);
    this.isActionsMenuOpen.set(false);
    this.showRenameModal.set(false);
    this.showNewPortfolioModal.set(false);
    this.showAddAssetModal.set(false);
    this.editingAsset.set(null);
    this.assetsPage.set(1);
    this.txPage.set(1);
    this.historyChartData.set(this.buildEmptyHistoryChart());
    this.overviewHistoryChartData.set(this.buildEmptyHistoryChart());
  }

  private async connectSignalR(): Promise<void> {
    await this.marketDataSignalR.connect();

    this.marketDataSignalR.stockTick$
      .pipe(takeUntil(this.destroy$))
      .subscribe(tick => {
        const isActivePortfolioTick = this.isBistTickForActivePortfolio(tick.ticker);

        this.portfolios.update(portfolios =>
          portfolios.map(pf => ({
            ...pf,
            assets: pf.assets.map(asset => {
              if (asset.assetType !== AssetType.BIST) return asset;
              if (this.toBistTicker(asset.symbol) !== tick.ticker) return asset;
              return { ...asset, currentValue: tick.price, currentValueUpdatedAtUtc: tick.updatedAt };
            }),
          }))
        );

        const bistSymbol = tick.ticker.replace(/\.IS$/, '');
        this.liveChanges.update(map => {
          const next = new Map(map);
          next.set(bistSymbol, { change1h: null, change24h: tick.changePercent, change4h: null });
          return next;
        });

        if (isActivePortfolioTick) this.scheduleHistoryRefreshFromTick();
      });

    this.marketDataSignalR.forexTick$
      .pipe(takeUntil(this.destroy$))
      .subscribe(tick => {
        if (tick.pair?.toUpperCase() === 'USDTRY' && tick.rate > 0) {
          this.usdTryRate.set(tick.rate);
        }
      });

    this.marketDataSignalR.cryptoTick$
      .pipe(takeUntil(this.destroy$))
      .subscribe(tick => {
        const isActivePortfolioTick = this.isCryptoTickForActivePortfolio(tick.symbol);

        this.portfolios.update(portfolios =>
          portfolios.map(pf => ({
            ...pf,
            assets: pf.assets.map(asset => {
              if (asset.assetType !== AssetType.Crypto) return asset;
              if (asset.symbol.toUpperCase() + 'USDT' !== tick.symbol.toUpperCase()) return asset;
              return { ...asset, currentValue: tick.priceUsdt, currentValueUpdatedAtUtc: tick.updatedAt };
            }),
          }))
        );

        const baseAsset = tick.symbol.toUpperCase().replace(/USDT$/, '');
        this.liveChanges.update(map => {
          const next = new Map(map);
          next.set(baseAsset, {
            change1h:  tick.changePercent1h  ?? null,
            change24h: tick.changePercent24h,
            change4h:  tick.changePercent4h  ?? null,
          });
          return next;
        });

        if (isActivePortfolioTick) this.scheduleHistoryRefreshFromTick();
      });
  }

  private async subscribePortfolioAssets(portfolios: PortfolioModel[]): Promise<void> {
    const bistTickers: string[] = [];
    const cryptoSymbols: string[] = [];

    for (const pf of portfolios) {
      for (const asset of pf.assets ?? []) {
        if (asset.assetType === AssetType.BIST) {
          const ticker = this.toBistTicker(asset.symbol);
          if (!bistTickers.includes(ticker)) bistTickers.push(ticker);
        } else if (asset.assetType === AssetType.Crypto) {
          const symbol = asset.symbol.toUpperCase() + 'USDT';
          if (!cryptoSymbols.includes(symbol)) cryptoSymbols.push(symbol);
        }
      }
    }

    await this.marketDataSignalR.subscribeToStocks(bistTickers);
    await this.marketDataSignalR.subscribeToCryptos(cryptoSymbols);
  }

  private loadOverview(): void {
    const portfolio = this.currentPortfolio();
    if (!portfolio) {
      this.overview.set(null);
      return;
    }

    const requestSeq = ++this.overviewRequestSeq;
    this.portfolioRepo
      .getPortfolioOverview(portfolio.id, this.historyCurrency())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: overview => {
          if (requestSeq !== this.overviewRequestSeq) return;
          this.overview.set(overview);
        },
        error: err => {
          if (requestSeq !== this.overviewRequestSeq) return;
          this.overview.set(null);
          console.error('Failed to load portfolio overview', err);
        },
      });
  }

  private seedBistDailyChanges(portfolios: PortfolioModel[]): void {
    const ownedBistSymbols = new Set<string>();
    for (const pf of portfolios) {
      for (const asset of pf.assets ?? []) {
        if (asset.assetType === AssetType.BIST) {
          ownedBistSymbols.add(asset.symbol.toUpperCase());
        }
      }
    }

    if (ownedBistSymbols.size === 0) return;

    this.marketDataRepository
      .getSnapshot()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: snapshot => {
          const changeBySymbol = new Map<string, number>();
          for (const item of snapshot.stocks ?? []) {
            const symbol = item.ticker?.replace(/\.IS$/i, '').toUpperCase();
            if (!symbol || !Number.isFinite(item.changePercent)) continue;
            changeBySymbol.set(symbol, item.changePercent);
          }

          this.liveChanges.update(map => {
            const next = new Map(map);
            for (const symbol of ownedBistSymbols) {
              const dailyChange = changeBySymbol.get(symbol);
              if (dailyChange === undefined) continue;
              const existing = next.get(symbol);
              next.set(symbol, {
                change1h:  existing?.change1h  ?? null,
                change24h: dailyChange,
                change4h:  existing?.change4h  ?? null,
              });
            }
            return next;
          });
        },
        error: () => {},
      });
  }

  formatSummaryAmount(amount: number): string {
    const normalized = Number.isFinite(amount) ? amount : 0;
    return this.formatCurrencyAmount(normalized, this.historyCurrency());
  }

  formatTxAmount(amount: number, currency: string): string {
    const normalized = Number.isFinite(amount) ? amount : 0;
    return this.formatCurrencyAmount(normalized, currency);
  }

  formatCurrencyAmount(amount: number, currency: string): string {
    const normalized = Number.isFinite(amount) ? amount : 0;
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(normalized);
  }

  formatTxDate(isoDate: string): string {
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoDate));
  }

  isPositivePerformer(change: number): boolean {
    return change > 0;
  }

  isNegativePerformer(change: number): boolean {
    return change < 0;
  }

  formatPerformerValue(value: number, change: number): string {
    const prefix = change > 0 ? '+' : change < 0 ? '-' : '';
    return `${prefix}${this.formatSummaryAmount(value)}`;
  }

  shouldShowTxNotes(tx: TransactionRow): boolean {
    return tx.type === 'Buy' && !!tx.notes;
  }

  private unsubscribeAllAssets(): void {
    for (const pf of this.portfolios()) {
      for (const asset of pf.assets ?? []) {
        if (asset.assetType === AssetType.BIST) {
          this.marketDataSignalR.unsubscribeFromStock(this.toBistTicker(asset.symbol));
        } else if (asset.assetType === AssetType.Crypto) {
          this.marketDataSignalR.unsubscribeFromCrypto(asset.symbol.toUpperCase() + 'USDT');
        }
      }
    }
  }

  loadTransactions(): void {
    const portfolio = this.currentPortfolio();
    if (!portfolio) {
      this.rawTransactions.set([]);
      return;
    }
    this.portfolioRepo.getTransactions(portfolio.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: PortfolioTransaction[]) => this.rawTransactions.set(data),
        error: () => this.rawTransactions.set([]),
      });
  }

  loadPortfolios(): void {
    this.isLoading.set(true);
    const clientId = this.clientPortfolioOwnerId();
    const portfoliosRequest = clientId
      ? this.portfolioRepo.getClientPortfolios(clientId)
      : this.portfolioRepo.getMyPortfolios();

    forkJoin({
      forex: this.marketDataRepository.getUsdTryRate().pipe(catchError(() => of(null))),
      portfolios: portfoliosRequest,
    })
      .pipe(finalize(() => this.isLoading.set(false)), takeUntil(this.destroy$))
      .subscribe({
        next: ({ forex, portfolios }) => {
          if (forex?.rate && forex.rate > 0) this.usdTryRate.set(forex.rate);
          this.portfolios.set(portfolios);
          this.applyRequestedPortfolio(false);
          this.seedBistDailyChanges(portfolios);
          this.subscribePortfolioAssets(portfolios);
          this.loadOverview();
          this.loadHistoryChart(true);
          if (this.isOverviewSelected()) {
            this.loadAllOverviews();
            this.loadOverviewHistoryChart();
          }
          this.loadTransactions();
          this.loadAllTransactions();
        },
        error: (err: unknown) => {
          this.alertService.show('error', 'Portföyler yüklenirken bir hata oluştu');
          console.error('Failed to load portfolios', err);
        },
      });
  }

  togglePortfolioDropdown(): void {
    this.isPortfolioDropdownOpen.update(v => !v);
  }

  selectPortfolio(index: number): void {
    this.isOverviewSelected.set(false);
    this.activePortfolioIndex.set(index);
    this.isPortfolioDropdownOpen.set(false);
    this.assetsPage.set(1);
    this.txPage.set(1);
    this.loadOverview();
    this.loadHistoryChart(true);
    this.loadTransactions();
  }

  goBackToCustomers(): void {
    void this.router.navigate(['/app/economist/customers']);
  }

  private applyRequestedPortfolio(refresh: boolean): void {
    const requestedId = this.requestedPortfolioId();
    if (!requestedId) return;

    const index = this.portfolios().findIndex(portfolio => portfolio.id === requestedId);
    if (index < 0 || this.activePortfolioIndex() === index) return;

    this.isOverviewSelected.set(false);
    this.activePortfolioIndex.set(index);
    this.isPortfolioDropdownOpen.set(false);
    this.assetsPage.set(1);
    this.txPage.set(1);

    if (refresh) {
      this.loadOverview();
      this.loadHistoryChart(true);
      this.loadTransactions();
    }
  }

  createNewPortfolio(name: string, description: string = ''): void {
    if (this.isReadOnly()) return;
    if (!name) return;
    this.portfolioRepo.createPortfolio({ name, description }).subscribe({
      next: () => {
        this.showNewPortfolioModal.set(false);
        this.loadPortfolios();
        this.alertService.show('success', 'Portföy başarıyla oluşturuldu');
      },
      error: (err: unknown) => {
        const message = err instanceof Error ? err.message : 'Portföy oluşturulamadı';
        this.alertService.show('error', message);
      },
    });
  }

  openRenameModal(): void {
    if (this.isReadOnly()) return;
    const pf = this.currentPortfolio();
    if (!pf) return;
    this.renameValue.set(pf.name);
    this.showRenameModal.set(true);
    this.isActionsMenuOpen.set(false);
  }

  renameCurrentPortfolio(): void {
    if (this.isReadOnly()) return;
    const pf = this.currentPortfolio();
    if (!pf) return;

    const newName = this.renameValue().trim();
    if (!newName) {
      this.alertService.show('error', 'Portföy ismi boş olamaz');
      return;
    }

    if (newName === pf.name) {
      this.showRenameModal.set(false);
      return;
    }

    this.portfolioRepo.updatePortfolio(pf.id, { name: newName })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showRenameModal.set(false);
          this.loadPortfolios();
          this.alertService.show('success', 'Portföy ismi güncellendi');
        },
        error: (err: unknown) => {
          const message = err instanceof Error ? err.message : 'Güncelleme sırasında hata oluştu';
          this.alertService.show('error', message);
        }
      });
  }

  async deleteCurrentPortfolio(): Promise<void> {
    if (this.isReadOnly()) return;
    const pf = this.currentPortfolio();
    if (!pf) return;

    const confirmed = await this.alertService.confirm(`"${pf.name}" portföyünü silmek istediğinize emin misiniz?`);
    if (!confirmed) return;

    this.portfolioRepo.deletePortfolio(pf.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: () => {
        this.activePortfolioIndex.set(0);
        this.loadPortfolios();
        this.alertService.show('success', 'Portföy silindi');
      },
      error: (err: unknown) => {
        const message = err instanceof Error ? err.message : 'Portföy silinirken hata oluştu';
        this.alertService.show('error', message);
      },
    });
  }

  maskVal(v: string): string {
    return this.isPrivacyMode() ? '••••••' : v;
  }

  toggleEconomistVisibility(): void {
    if (this.isReadOnly()) return;
    const pf = this.currentPortfolio();
    if (!pf) return;

    const newValue = !pf.isHiddenFromEconomists;
    this.isActionsMenuOpen.set(false);

    this.portfolioRepo.setEconomistVisibility(pf.id, newValue)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadPortfolios();
          const msg = newValue
            ? 'Bu portföy ekonomistlerden gizlendi'
            : 'Bu portföy ekonomistlere açıldı';
          this.alertService.show('success', msg);
        },
        error: () => this.alertService.show('error', 'Görünürlük ayarı güncellenemedi'),
      });
  }

  addAsset(symbol: string, assetName: string, assetType: string, quantity: number, averageCost: number, currency: string, acquiredAtUtc: string, notes: string): void {
    if (this.isReadOnly()) return;
    const pf = this.currentPortfolio();
    if (!pf) return;

    const editItem = this.editingAsset();

    if (editItem) {
      this.portfolioRepo.updateAsset(editItem.id, { quantity, averageCost, notes: notes || undefined }).subscribe({
        next: () => {
          this.closeAssetModal();
          this.loadPortfolios();
          this.alertService.show('success', 'Varlık güncellendi');
        },
        error: (err: unknown) => {
          const message = err instanceof Error ? err.message : 'Güncelleme sırasında hata oluştu';
          this.alertService.show('error', message);
        },
      });
    } else {
      this.portfolioRepo.addAsset(pf.id, {
        symbol, assetName, assetType, quantity, averageCost, currency,
        acquiredAtUtc: acquiredAtUtc ? new Date(acquiredAtUtc).toISOString() : new Date().toISOString(),
        notes: notes || undefined,
      }).subscribe({
        next: () => {
          this.closeAssetModal();
          this.loadPortfolios();
          this.alertService.show('success', 'Varlık eklendi');
        },
        error: (err: unknown) => {
          const message = err instanceof Error ? err.message : 'Ekleme sırasında hata oluştu';
          this.alertService.show('error', message);
        },
      });
    }
  }

  async deleteTransaction(transactionId: number): Promise<void> {
    if (this.isReadOnly()) return;
    const confirmed = await this.alertService.confirm('Bu işlemi silmek istediğinize emin misiniz?');
    if (!confirmed) return;

    this.portfolioRepo.deleteTransaction(transactionId).subscribe({
      next: () => {
        this.rawTransactions.update(txs => txs.filter(t => t.id !== transactionId));
        this.alertService.show('success', 'İşlem silindi');
      },
      error: () => this.alertService.show('error', 'İşlem silinirken hata oluştu'),
    });
  }

  async deleteAsset(assetId: number): Promise<void> {
    if (this.isReadOnly()) return;
    const confirmed = await this.alertService.confirm('Bu varlığı silmek istediğinize emin misiniz?');
    if (!confirmed) return;

    this.portfolioRepo.deleteAsset(assetId).subscribe({
      next: () => {
        this.loadPortfolios();
        this.alertService.show('success', 'Varlık kaldırıldı');
      },
      error: (err: unknown) => {
        const message = err instanceof Error ? err.message : 'Silme işlemi sırasında hata oluştu';
        this.alertService.show('error', message);
      },
    });
  }

  openAddAssetModal(): void {
    if (this.isReadOnly()) return;
    this.editingAsset.set(null);
    this.modalAssetType.set('BIST');
    this.modalCurrency.set('TRY');
    this.showAssetSelectModal.set(false);
    this.modalSelectedSymbol.set('');
    this.modalSelectedName.set('');
    this.showAddAssetModal.set(true);
  }

  onAssetSelected(asset: SelectedAsset): void {
    this.modalSelectedSymbol.set(asset.symbol);
    this.modalSelectedName.set(asset.name);
    this.showAssetSelectModal.set(false);
  }

  editAsset(asset: PortfolioAsset): void {
    if (this.isReadOnly()) return;
    this.editingAsset.set(asset);
    this.modalAssetType.set(asset.assetType);
    this.modalCurrency.set(asset.currency);
    this.showAssetSelectModal.set(false);
    this.showAddAssetModal.set(true);
  }

  closeAssetModal(): void {
    this.showAssetSelectModal.set(false);
    this.showAddAssetModal.set(false);
    this.editingAsset.set(null);
  }

  onModalAssetTypeChange(type: string): void {
    this.modalAssetType.set(type);
    this.modalSelectedSymbol.set('');
    this.modalSelectedName.set('');
    switch (type) {
      case 'BIST':          this.modalCurrency.set('TRY'); break;
      case 'Crypto':
      case 'PreciousMetal':
      default:              this.modalCurrency.set('USD'); break;
    }
  }

  setRange(value: string): void {
    this.activeRange.set(value);
    this.loadHistoryChart(true);
    if (this.isOverviewSelected()) this.loadOverviewHistoryChart();
  }

  setHistoryCurrency(value: string): void {
    if (value !== 'TRY' && value !== 'USD') return;
    if (value === this.historyCurrency()) return;
    this.historyCurrency.set(value);
    this.loadOverview();
    this.loadHistoryChart(true);
    if (this.isOverviewSelected()) {
      this.loadAllOverviews();
      this.loadOverviewHistoryChart();
    }
  }

  onChartViewChange(view: string): void {
    if (!this.isHistoryView(view)) return;
    this.activeChartView.set(view);
    this.loadHistoryChart(true);
  }

  setOverviewDoughnutFilter(value: string): void {
    if (value === 'asset' || value === 'portfolio') {
      this.overviewDoughnutFilter.set(value);
    }
  }

  setPerformerFilter(value: string): void {
    this.performerFilter.set(value);
  }

  setAssetViewFilter(value: string): void {
    this.assetViewFilter.set(value);
    this.assetsPage.set(1);
    this.txPage.set(1);
  }

  setAssetsPanelView(value: string): void {
    if (value === 'assets' || value === 'transactions') {
      this.assetsPanelView.set(value);
    }
  }

  sortAssetByDir(col: AssetSortCol, dir: SortDir): void {
    const current = this.assetColSort();
    if (current?.col === col && current?.dir === dir) {
      this.assetColSort.set(null);
    } else {
      this.assetColSort.set({ col, dir });
    }
    this.assetsPage.set(1);
  }

  isAssetSortActive(col: AssetSortCol, dir: SortDir): boolean {
    const current = this.assetColSort();
    return current?.col === col && current?.dir === dir;
  }

  sortTxByDir(col: TxSortCol, dir: SortDir): void {
    const current = this.txColSort();
    if (current?.col === col && current?.dir === dir) {
      this.txColSort.set(null);
    } else {
      this.txColSort.set({ col, dir });
    }
    this.txPage.set(1);
  }

  isTxSortActive(col: TxSortCol, dir: SortDir): boolean {
    const current = this.txColSort();
    return current?.col === col && current?.dir === dir;
  }

  getAssetUnitPrice(asset: PortfolioAsset): number {
    const raw = asset.currentValue || asset.averageCost;
    return this.convertToDisplayCurrency(raw, asset.currency);
  }

  getAssetAverageCost(asset: PortfolioAsset): number {
    return this.convertToDisplayCurrency(asset.averageCost, asset.currency);
  }

  getAssetHoldingValue(asset: PortfolioAsset): number {
    return asset.quantity * this.getAssetUnitPrice(asset);
  }

  getAssetProfitLoss(asset: PortfolioAsset): number {
    return (this.getAssetUnitPrice(asset) - this.getAssetAverageCost(asset)) * asset.quantity;
  }

  getAssetProfitLossPercent(asset: PortfolioAsset): number {
    if (asset.averageCost <= 0) return 0;
    const current = asset.currentValue || asset.averageCost;
    return ((current - asset.averageCost) / asset.averageCost) * 100;
  }

  focusOverview(): void {
    this.isOverviewSelected.set(true);
    this.assetsPanelView.set('assets');
    this.assetsPage.set(1);
    this.txPage.set(1);
    this.loadAllOverviews();
    this.loadOverviewHistoryChart();
  }

  private loadAllOverviews(): void {
    const portfolios = this.portfolios();
    if (!portfolios.length) {
      this.allOverviews.set([]);
      return;
    }

    const requestSeq = ++this.allOverviewsRequestSeq;
    const currency = this.historyCurrency();
    forkJoin(portfolios.map(pf =>
      this.portfolioRepo.getPortfolioOverview(pf.id, currency)
    ))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: overviews => {
          if (requestSeq !== this.allOverviewsRequestSeq) return;
          this.allOverviews.set(overviews);
        },
        error: () => {
          if (requestSeq !== this.allOverviewsRequestSeq) return;
          this.allOverviews.set([]);
        },
      });
  }

  private loadAllTransactions(): void {
    const portfolios = this.portfolios();
    if (!portfolios.length) {
      this.allRawTransactions.set([]);
      return;
    }
    forkJoin(portfolios.map(pf =>
      this.portfolioRepo.getTransactions(pf.id)
    ))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: results => this.allRawTransactions.set(results.flat()),
        error: () => this.allRawTransactions.set([]),
      });
  }

  private loadOverviewHistoryChart(): void {
    const portfolios = this.portfolios();
    if (!portfolios.length) {
      this.overviewHistoryChartData.set(this.buildEmptyHistoryChart());
      return;
    }

    const requestSeq = ++this.overviewHistoryRequestSeq;
    const currency = this.historyCurrency();
    const range = this.activeRange();

    const requests = portfolios.map(pf =>
      this.portfolioRepo.getPortfolioHistory(pf.id, range, currency)
    );

    forkJoin(requests)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: histories => {
          if (requestSeq !== this.overviewHistoryRequestSeq) return;
          const labels = histories.reduce(
            (longest, h) => (h.labels.length > longest.length ? h.labels : longest),
            [] as string[]
          );

          const summed = labels.map((label, i) =>
            histories.reduce((sum, h) => {
              const idx = h.labels.length === labels.length ? i : h.labels.indexOf(label);
              return sum + (idx >= 0 ? (Number(h.values[idx]) || 0) : 0);
            }, 0)
          );

          if (!summed.length) {
            this.overviewHistoryChartData.set(this.buildEmptyHistoryChart());
            return;
          }

          const isUptrend = summed[summed.length - 1] >= summed[0];
          const lineColor = isUptrend ? this.profitColor : this.lossColor;
          const areaColor = isUptrend ? `${this.profitColor}33` : this.lossAlpha;

          this.overviewHistoryChartData.set({
            labels,
            series: [{ data: summed, color: lineColor, areaColor }],
          });
        },
        error: () => {
          if (requestSeq !== this.overviewHistoryRequestSeq) return;
          this.overviewHistoryChartData.set(this.buildEmptyHistoryChart());
        },
      });
  }

  exportCsv(): void {
    const pf = this.currentPortfolio();
    if (!pf?.assets?.length) return;
    const header = 'Sembol,Ad,Tür,Miktar,Ortalama Maliyet,Para Birimi,Güncel Değer,Kâr/Zarar,Kâr/Zarar%';
    const rows = pf.assets.map(a => {
      const cv = a.currentValue ?? a.averageCost;
      const pnl = (cv - a.averageCost) * a.quantity;
      const pnlPct = a.averageCost > 0 ? ((cv - a.averageCost) / a.averageCost * 100).toFixed(2) : '0';
      return `${a.symbol},${a.assetName},${a.assetType},${a.quantity},${a.averageCost},${a.currency},${cv.toFixed(2)},${pnl.toFixed(2)},${pnlPct}`;
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${pf.name}-portfolio.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.isActionsMenuOpen.set(false);
  }

  private toPercentSeries(values: number[]): number[] {
    if (!values.length) return [];
    const base = values[0] || 1;
    return values.map(v => Number((((v - base) / base) * 100).toFixed(2)));
  }

  private loadHistoryChart(force: boolean): void {
    const portfolio = this.currentPortfolio();
    if (!portfolio) {
      this.historyChartData.set(this.buildEmptyHistoryChart());
      return;
    }

    if (force) {
      this.historyRefreshPending = false;
      this.historyForceRefreshPending = false;
      this.clearHistoryDebounceTimer();
    }

    if (this.historyRefreshInFlight) {
      this.historyRefreshPending = true;
      if (force) this.historyForceRefreshPending = true;
      return;
    }

    if (!force) {
      const elapsed = Date.now() - this.lastHistoryRefreshAt;
      if (elapsed < this.historyMinRefreshGapMs) {
        const waitMs = this.historyMinRefreshGapMs - elapsed;
        this.historyRefreshPending = true;
        this.clearHistoryDebounceTimer();
        this.historyDebounceTimer = setTimeout(() => {
          this.historyDebounceTimer = null;
          this.flushPendingHistoryRefresh();
        }, waitMs);
        return;
      }
    }

    this.historyRefreshInFlight = true;

    this.portfolioRepo
      .getPortfolioHistory(portfolio.id, this.activeRange(), this.historyCurrency())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (history: PortfolioHistory) => {
          this.historyChartData.set(this.mapHistoryToChart(history));
        },
        error: (err: unknown) => {
          this.historyChartData.set(this.buildEmptyHistoryChart());
          console.error('Failed to load portfolio history', err);
        },
        complete: () => {
          this.historyRefreshInFlight = false;
          this.lastHistoryRefreshAt = Date.now();

          if (this.historyRefreshPending) {
            const forceRefresh = this.historyForceRefreshPending;
            this.historyRefreshPending = false;
            this.historyForceRefreshPending = false;
            if (forceRefresh) {
              this.loadHistoryChart(true);
            } else {
              this.scheduleHistoryRefreshFromTick();
            }
          }
        },
      });
  }

  private scheduleHistoryRefreshFromTick(): void {
    this.historyRefreshPending = true;
    this.clearHistoryDebounceTimer();
    this.historyDebounceTimer = setTimeout(() => {
      this.historyDebounceTimer = null;
      this.flushPendingHistoryRefresh();
    }, this.historyDebounceMs);
  }

  private flushPendingHistoryRefresh(): void {
    if (!this.historyRefreshPending) return;
    this.loadHistoryChart(false);
  }

  private clearHistoryDebounceTimer(): void {
    if (this.historyDebounceTimer) {
      clearTimeout(this.historyDebounceTimer);
      this.historyDebounceTimer = null;
    }
  }

  private isHistoryView(view: string): view is 'history' | 'performance' {
    return view === 'history' || view === 'performance';
  }

  private matchesAssetViewFilter(assetType: AssetType): boolean {
    const filter = this.assetViewFilter();
    return filter === 'all' || assetType === filter;
  }

  private buildOverviewAssetKey(asset: Pick<PortfolioAsset, 'symbol' | 'assetType'>): string {
    return `${asset.assetType}:${asset.symbol.toUpperCase()}`;
  }

  private isBistTickForActivePortfolio(ticker: string): boolean {
    const normalizedTicker = ticker.toUpperCase();
    const assets = this.currentPortfolio()?.assets ?? [];
    return assets.some(a => a.assetType === AssetType.BIST && this.toBistTicker(a.symbol) === normalizedTicker);
  }

  private isCryptoTickForActivePortfolio(symbol: string): boolean {
    const normalizedSymbol = symbol.toUpperCase();
    const assets = this.currentPortfolio()?.assets ?? [];
    return assets.some(a => a.assetType === AssetType.Crypto && `${a.symbol.toUpperCase()}USDT` === normalizedSymbol);
  }

  private toBistTicker(symbol: string): string {
    const normalized = symbol.toUpperCase();
    return normalized.endsWith('.IS') ? normalized : `${normalized}.IS`;
  }

  private mapHistoryToChart(history: PortfolioHistory): LineChartInput {
    const numericValues = (history.values ?? []).map(v => Number(v));
    if (!numericValues.length) return this.buildEmptyHistoryChart();

    const isUptrend = numericValues[numericValues.length - 1] >= numericValues[0];
    const lineColor  = isUptrend ? this.profitColor : this.lossColor;
    const areaColor  = isUptrend ? `${this.profitColor}33` : this.lossAlpha;

    return {
      labels: history.labels ?? [],
      series: [{ data: numericValues, color: lineColor, areaColor }],
    };
  }

  private buildEmptyHistoryChart(): LineChartInput {
    return {
      labels: [],
      series: [{ data: [], color: this.lossColor, areaColor: this.lossAlpha }],
    };
  }
}
