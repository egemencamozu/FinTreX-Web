import { Component, signal, computed } from '@angular/core';
import bistData from '../../mock/watchlist-bist.mock.json';
import preciousData from '../../mock/watchlist-precious.mock.json';
import cryptoData from '../../mock/watchlist-crypto.mock.json';
import fxData from '../../mock/watchlist-fx.mock.json';
import metricsData from '../../mock/watchlist-market-metrics.mock.json';

export type WatchlistCategory = 'bist' | 'precious' | 'crypto' | 'fx';
type SortField = 'rank' | 'symbol' | 'name' | 'price' | 'change1h' | 'changePercent' | 'change7d' | 'volume' | 'marketCap';

interface WatchlistItem {
  id: string; rank: number; symbol: string; name: string; price: number; currency: string;
  change: number; changePercent: number; change1h: number; change7d: number;
  high24h: number; low24h: number; volume: number; marketCap: number | null;
  circulatingSupply: number | null; totalSupply: number | null; lastUpdated: string;
  sparkline: number[]; alertEnabled: boolean; category: WatchlistCategory;
}

interface MarketMetrics {
  totalMarketCapUsd: number; totalMarketCapChange24h: number; volume24hUsd: number;
  volume24hChange24h: number; fearGreedValue: number; fearGreedLabel: string;
  btcDominance: number; btcDominanceChange24h: number; bist100Value: number;
  bist100Change24h: number; altcoinSeasonIndex: number; marketCapSparkline: number[];
  bist100Sparkline: number[];
}

interface TabConfig { id: WatchlistCategory; label: string; colorClass: string; }

const FULL_CATALOG: WatchlistItem[] = [
  ...(bistData as WatchlistItem[]), ...(preciousData as WatchlistItem[]),
  ...(cryptoData as WatchlistItem[]), ...(fxData as WatchlistItem[]),
];

@Component({
  selector: 'app-watchlist',
  standalone: true,
  imports: [],
  templateUrl: './watchlist.html',
  styleUrl: './watchlist.scss',
})
export class Watchlist {
  readonly tabs: TabConfig[] = [
    { id: 'bist', label: 'BIST 100', colorClass: 'bist' },
    { id: 'precious', label: 'Değerli Madenler', colorClass: 'precious' },
    { id: 'crypto', label: 'Kripto Para', colorClass: 'crypto' },
    { id: 'fx', label: 'Döviz', colorClass: 'fx' },
  ];

  readonly activeTab = signal<WatchlistCategory>('bist');
  readonly searchQuery = signal('');
  readonly sortField = signal<SortField>('rank');
  readonly sortDirection = signal<'asc' | 'desc'>('asc');
  readonly lastRefresh = signal(new Date());
  readonly showAddModal = signal(false);
  readonly modalSearch = signal('');
  readonly modalActiveTab = signal<WatchlistCategory>('bist');
  readonly marketMetrics = signal<MarketMetrics>(metricsData as MarketMetrics);
  readonly allItems = signal<WatchlistItem[]>(FULL_CATALOG.map(item => ({ ...item })));

  readonly categoryCount = computed(() => {
    const items = this.allItems();
    return {
      bist: items.filter(i => i.category === 'bist').length,
      precious: items.filter(i => i.category === 'precious').length,
      crypto: items.filter(i => i.category === 'crypto').length,
      fx: items.filter(i => i.category === 'fx').length,
    };
  });

  readonly totalCount = computed(() => this.allItems().length);
  readonly gainersCount = computed(() => this.allItems().filter(i => i.changePercent > 0).length);
  readonly losersCount = computed(() => this.allItems().filter(i => i.changePercent < 0).length);
  readonly alertsCount = computed(() => this.allItems().filter(i => i.alertEnabled).length);
  readonly activeItems = computed(() => this.allItems().filter(i => i.category === this.activeTab()));

  readonly filteredItems = computed(() => {
    let items = this.activeItems();
    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      items = items.filter(i => i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));
    }
    const field = this.sortField();
    const dir = this.sortDirection();
    return [...items].sort((a, b) => {
      const av = a[field as keyof WatchlistItem] as string | number | null;
      const bv = b[field as keyof WatchlistItem] as string | number | null;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === 'string' && typeof bv === 'string') {
        return dir === 'asc' ? av.localeCompare(bv, 'tr') : bv.localeCompare(av, 'tr');
      }
      return dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  });

  readonly topGainers = computed(() =>
    [...this.allItems()].filter(i => i.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent).slice(0, 5));
  readonly topLosers = computed(() =>
    [...this.allItems()].filter(i => i.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, 5));
  readonly alertItems = computed(() => this.allItems().filter(i => i.alertEnabled));

  readonly categoryDistribution = computed(() => {
    const total = this.totalCount() || 1;
    const count = this.categoryCount();
    return this.tabs.map(t => ({ ...t, count: count[t.id], pct: Math.round((count[t.id] / total) * 100) }));
  });

  readonly addableCatalogItems = computed(() => {
    const ids = new Set(this.allItems().map(i => i.id));
    const q = this.modalSearch().toLowerCase().trim();
    return FULL_CATALOG.filter(i => {
      if (ids.has(i.id)) return false;
      if (i.category !== this.modalActiveTab()) return false;
      if (!q) return true;
      return i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q);
    });
  });

  readonly fearGreedClass = computed(() => {
    const v = this.marketMetrics().fearGreedValue;
    if (v <= 24) return 'extreme-fear';
    if (v <= 44) return 'fear';
    if (v <= 55) return 'neutral';
    if (v <= 74) return 'greed';
    return 'extreme-greed';
  });

  setTab(tab: WatchlistCategory): void { this.activeTab.set(tab); this.searchQuery.set(''); }
  sortBy(field: SortField): void {
    if (this.sortField() === field) { this.sortDirection.update(d => (d === 'asc' ? 'desc' : 'asc')); }
    else { this.sortField.set(field); this.sortDirection.set(field === 'rank' ? 'asc' : 'desc'); }
  }
  removeItem(id: string): void { this.allItems.update(items => items.filter(i => i.id !== id)); }
  toggleAlert(id: string): void {
    this.allItems.update(items => items.map(i => (i.id === id ? { ...i, alertEnabled: !i.alertEnabled } : i)));
  }
  addItem(item: WatchlistItem): void { this.allItems.update(items => [...items, { ...item }]); }
  refresh(): void { this.lastRefresh.set(new Date()); }
  openAddModal(): void { this.modalSearch.set(''); this.modalActiveTab.set(this.activeTab()); this.showAddModal.set(true); }
  closeAddModal(): void { this.showAddModal.set(false); }
  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('watchlist-c__modal-backdrop')) { this.closeAddModal(); }
  }

  getSparklinePoints(data: number[], w = 80, h = 32): string {
    if (!data || data.length < 2) return '';
    const min = Math.min(...data); const max = Math.max(...data); const range = max - min || 1;
    return data.map((v, i) => {
      const x = (i / (data.length - 1)) * w; const y = h - ((v - min) / range) * (h - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  getPriceRangePosition(price: number, low: number, high: number): number {
    const range = high - low; if (range === 0) return 50;
    return Math.max(0, Math.min(100, ((price - low) / range) * 100));
  }

  formatPrice(price: number, currency: string): string {
    const decimals = Math.abs(price) < 0.01 ? 6 : Math.abs(price) < 1 ? 4 : Math.abs(price) < 100 ? 4 : 2;
    const formatted = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(price);
    return currency ? `${formatted} ${currency}` : formatted;
  }

  formatChange(change: number, currency: string): string {
    const prefix = change >= 0 ? '+' : '';
    const decimals = Math.abs(change) < 0.01 ? 6 : Math.abs(change) < 1 ? 4 : 2;
    const formatted = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(change);
    return `${prefix}${formatted} ${currency}`;
  }

  formatPercent(pct: number): string { const prefix = pct >= 0 ? '+' : ''; return `${prefix}${Math.abs(pct).toFixed(2)}%`; }

  formatVolume(vol: number): string {
    if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)}B`;
    if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
    if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
    if (vol === 0) return '—'; return vol.toString();
  }

  formatMarketCap(cap: number | null): string {
    if (cap === null) return '—';
    if (cap >= 1_000_000_000_000) return `${(cap / 1_000_000_000_000).toFixed(2)}T`;
    if (cap >= 1_000_000_000) return `${(cap / 1_000_000_000).toFixed(2)}B`;
    if (cap >= 1_000_000) return `${(cap / 1_000_000).toFixed(2)}M`;
    return cap.toLocaleString('tr-TR');
  }

  formatSupply(supply: number | null): string {
    if (supply === null) return '—';
    if (supply >= 1_000_000_000) return `${(supply / 1_000_000_000).toFixed(2)}B`;
    if (supply >= 1_000_000) return `${(supply / 1_000_000).toFixed(2)}M`;
    if (supply >= 1_000) return `${(supply / 1_000).toFixed(1)}K`;
    return supply.toString();
  }

  formatLastRefresh(date: Date): string {
    return new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date);
  }

  getCategoryLabel(cat: WatchlistCategory): string {
    const labels: Record<WatchlistCategory, string> = { bist: 'BIST 100', precious: 'Değerli Maden', crypto: 'Kripto', fx: 'Döviz' };
    return labels[cat];
  }

  getCategoryCount(cat: WatchlistCategory): number { return this.categoryCount()[cat]; }
  isSortActive(field: SortField): boolean { return this.sortField() === field; }
  get showSupplyColumn(): boolean { return this.activeTab() === 'crypto'; }
  get showMarketCapColumn(): boolean { return this.activeTab() === 'bist' || this.activeTab() === 'crypto'; }
}
