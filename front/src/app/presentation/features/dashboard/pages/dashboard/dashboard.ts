import { Component, signal, computed } from '@angular/core';
import mockData from '../../mock/dashboard.mock.json';

// ── Types ──────────────────────────────────────────────────────────────────────

type ChartRange = '1g' | '1h' | '3a' | '1a' | '1y' | 'ytd' | 'tumu';
type MoverTab = 'gainers' | 'losers';

interface PortfolioSegment {
  valueTry: number;
  weight: number;
  dailyChangePct: number;
}

interface Portfolio {
  totalValueTry: number;
  totalValueUsd: number;
  dailyChangeTry: number;
  dailyChangePct: number;
  weeklyChangeTry: number;
  weeklyChangePct: number;
  monthlyChangeTry: number;
  monthlyChangePct: number;
  ytdChangeTry: number;
  ytdChangePct: number;
  bist: PortfolioSegment;
  crypto: PortfolioSegment;
  precious: PortfolioSegment;
  cash: PortfolioSegment;
}

interface Holding {
  id: string;
  symbol: string;
  name: string;
  category: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  currency: string;
  currentValueTry: number;
  costBasisTry: number;
  unrealizedPnlTry: number;
  unrealizedPnlPct: number;
  dailyChangePct: number;
  weight: number;
  sparkline: number[];
}

interface Transaction {
  id: string;
  type: 'buy' | 'sell';
  symbol: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
  currency: string;
  totalTry: number;
  date: string;
}

interface TickerItem {
  label: string;
  value: number;
  changePct: number;
}

interface Alert {
  id: string;
  type: string;
  symbol: string | null;
  message: string;
  time: string;
  read: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {

  // ── Static data ─────────────────────────────────────────────────────────────
  readonly portfolio = signal<Portfolio>(mockData.portfolio as Portfolio);
  readonly chartData = signal<Record<ChartRange, number[]>>(mockData.performanceChart as Record<ChartRange, number[]>);
  readonly holdings = signal<Holding[]>(mockData.holdings as Holding[]);
  readonly moversData = signal(mockData.movers);
  readonly transactions = signal<Transaction[]>(mockData.recentTransactions as Transaction[]);
  readonly ticker = signal<TickerItem[]>(mockData.ticker as TickerItem[]);
  readonly alerts = signal<Alert[]>(mockData.alerts as Alert[]);

  // ── UI state ────────────────────────────────────────────────────────────────
  readonly activeRange = signal<ChartRange>('1a');
  readonly activeMoverTab = signal<MoverTab>('gainers');
  readonly lastRefresh = signal(new Date());

  // ── Chart ranges config ─────────────────────────────────────────────────────
  readonly chartRanges: { id: ChartRange; label: string }[] = [
    { id: '1g', label: '1G' },
    { id: '1h', label: '1H' },
    { id: '3a', label: '3A' },
    { id: '1a', label: '1A' },
    { id: '1y', label: '1Y' },
    { id: 'ytd', label: 'YTD' },
    { id: 'tumu', label: 'Tümü' },
  ];

  // ── Derived ──────────────────────────────────────────────────────────────────
  readonly activeChartPoints = computed(() =>
    this.chartData()[this.activeRange()],
  );

  readonly chartPolyline = computed(() =>
    this.getChartPoints(this.activeChartPoints(), 560, 160),
  );

  readonly chartAreaPath = computed(() =>
    this.getChartArea(this.activeChartPoints(), 560, 160),
  );

  readonly chartIsUp = computed(() => {
    const pts = this.activeChartPoints();
    return pts[pts.length - 1] >= pts[0];
  });

  readonly chartMax = computed(() => Math.max(...this.activeChartPoints()));
  readonly chartMin = computed(() => Math.min(...this.activeChartPoints()));

  readonly activeMoverList = computed(() =>
    this.activeMoverTab() === 'gainers'
      ? this.moversData().gainers
      : this.moversData().losers,
  );

  readonly unreadAlerts = computed(() =>
    this.alerts().filter(a => !a.read).length,
  );

  readonly totalUnrealizedPnl = computed(() =>
    this.holdings().reduce((sum, h) => sum + h.unrealizedPnlTry, 0),
  );

  readonly totalUnrealizedPct = computed(() => {
    const totalCost = this.holdings().reduce((s, h) => s + h.costBasisTry, 0);
    if (!totalCost) return 0;
    return (this.totalUnrealizedPnl() / totalCost) * 100;
  });

  // ── Donut segments (conic-gradient stops) ────────────────────────────────────
  readonly donutSegments = computed(() => {
    const p = this.portfolio();
    return [
      { label: 'BIST', pct: p.bist.weight, colorVar: '--chart-bist' },
      { label: 'Kripto', pct: p.crypto.weight, colorVar: '--chart-crypto' },
      { label: 'Değ. Mad.', pct: p.precious.weight, colorVar: '--chart-precious' },
      { label: 'Nakit', pct: p.cash.weight, colorVar: '--chart-1' },
    ];
  });

  readonly donutGradient = computed(() => {
    let angle = 0;
    const stops = this.donutSegments().map(s => {
      const start = angle;
      angle += s.pct * 3.6; // pct → degrees
      return `var(${s.colorVar}) ${start}deg ${angle}deg`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  });

  // ── Category performance bars ─────────────────────────────────────────────
  readonly categoryBars = computed(() => {
    const p = this.portfolio();
    return [
      { label: 'BIST', pct: 74, changePct: p.bist.dailyChangePct, colorVar: '--chart-bist' },
      { label: 'Kripto', pct: 38, changePct: p.crypto.dailyChangePct, colorVar: '--chart-crypto' },
      { label: 'Değ. Mad.', pct: 22, changePct: p.precious.dailyChangePct, colorVar: '--chart-precious' },
    ];
  });

  // ── Actions ──────────────────────────────────────────────────────────────────

  setRange(range: ChartRange): void {
    this.activeRange.set(range);
  }

  setMoverTab(tab: MoverTab): void {
    this.activeMoverTab.set(tab);
  }

  refresh(): void {
    this.lastRefresh.set(new Date());
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  getChartPoints(data: number[], w: number, h: number): string {
    if (!data || data.length < 2) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pad = 12;
    return data.map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  getChartArea(data: number[], w: number, h: number): string {
    if (!data || data.length < 2) return '';
    const pts = this.getChartPoints(data, w, h);
    const first = pts.split(' ')[0];
    const last = pts.split(' ').at(-1)!;
    const lastX = last.split(',')[0];
    return `M ${first} L ${pts.split(' ').slice(1).join(' L ')} L ${lastX},${h} L 0,${h} Z`;
  }

  getSparklinePoints(data: number[], w = 80, h = 28): string {
    if (!data || data.length < 2) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    return data.map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  formatTry(val: number): string {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  }

  formatUsd(val: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  }

  formatCompact(val: number): string {
    if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
    if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
    return val.toFixed(2);
  }

  formatPct(pct: number, sign = true): string {
    const prefix = sign && pct >= 0 ? '+' : '';
    return `${prefix}${pct.toFixed(2)}%`;
  }

  formatPrice(price: number, currency: string): string {
    const decimals =
      Math.abs(price) < 0.01 ? 6 :
        Math.abs(price) < 1 ? 4 :
          Math.abs(price) < 100 ? 2 : 2;
    const formatted = new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(price);
    return `${formatted} ${currency}`;
  }

  formatDate(iso: string): string {
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  }

  formatLongDate(d: Date): string {
    return new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric', weekday: 'long',
    }).format(d);
  }

  formatRefresh(d: Date): string {
    return new Intl.DateTimeFormat('tr-TR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(d);
  }
}
