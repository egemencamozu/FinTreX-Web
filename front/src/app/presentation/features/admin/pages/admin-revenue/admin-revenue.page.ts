import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { AdminRevenueDashboardRepository } from '../../../../../core/interfaces/admin-revenue-dashboard.repository';
import {
  AdminDashboardStripeLive,
  AdminDashboardSummary,
  AdminDashboardTrends,
  MonthlyRevenue,
  PlanBreakdown,
  StatusDistribution,
} from '../../../../../core/models/admin-revenue-dashboard.model';
import {
  BarChartComponent,
  BarChartInput,
} from '../../../../shared/components/charts/bar-chart/bar-chart.component';
import {
  DoughnutChartComponent,
  DoughnutItem,
} from '../../../../shared/components/charts/doughnut-chart/doughnut-chart.component';
import {
  LineChartComponent,
  LineChartInput,
} from '../../../../shared/components/charts/line-chart/line-chart.component';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';

interface RevenueErrorState {
  summary?: string;
  trends?: string;
  live?: string;
}

interface StatusRow extends StatusDistribution {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') {
    return fallback;
  }

  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

@Component({
  selector: 'app-admin-revenue',
  standalone: true,
  imports: [
    CommonModule,
    KpiCardComponent,
    LineChartComponent,
    DoughnutChartComponent,
    BarChartComponent,
  ],
  templateUrl: './admin-revenue.page.html',
  styleUrl: './admin-revenue.page.scss',
})
export class AdminRevenuePage implements OnInit {
  private readonly repo = inject(AdminRevenueDashboardRepository);

  protected readonly loadingSummary = signal(true);
  protected readonly loadingTrends = signal(true);
  protected readonly loadingLive = signal(true);
  protected readonly errors = signal<RevenueErrorState>({});

  protected readonly summary = signal<AdminDashboardSummary | null>(null);
  protected readonly trends = signal<AdminDashboardTrends | null>(null);
  protected readonly live = signal<AdminDashboardStripeLive | null>(null);

  protected readonly isRefreshing = computed(
    () => this.loadingSummary() || this.loadingTrends() || this.loadingLive(),
  );

  protected readonly isPageLoading = computed(
    () => this.loadingSummary() || this.loadingTrends(),
  );

  protected readonly refundRate = computed(() => {
    const summary = this.summary();
    if (!summary?.grossRevenue) {
      return 0;
    }

    return -((summary.totalRefunded / summary.grossRevenue) * 100);
  });

  protected readonly netMarginRate = computed(() => {
    const summary = this.summary();
    if (!summary?.grossRevenue) {
      return 0;
    }

    return (summary.netRevenue / summary.grossRevenue) * 100;
  });

  protected readonly latestNetRevenueChange = computed(() => {
    const rows = this.trends()?.monthlyRevenue ?? [];
    if (rows.length < 2) {
      return null;
    }

    const last = rows[rows.length - 1].netRevenue;
    const previous = rows[rows.length - 2].netRevenue;
    return previous > 0 ? ((last - previous) / previous) * 100 : null;
  });

  protected readonly latestRevenueLabel = computed(() => {
    const rows = this.trends()?.monthlyRevenue ?? [];
    return rows.length ? rows[rows.length - 1].label : 'Veri yok';
  });

  protected readonly revenueLineData = computed<LineChartInput>(() => {
    const rows = this.trends()?.monthlyRevenue ?? [];
    const grossColor = cssVar('--chart-1', '#2563eb');
    const netColor = cssVar('--chart-profit', '#16a34a');
    const refundColor = cssVar('--chart-loss', '#dc2626');

    return {
      labels: rows.map(row => row.label),
      series: [
        {
          name: 'Brüt gelir',
          data: rows.map(row => row.grossRevenue),
          color: grossColor,
          areaColor: `${grossColor}24`,
        },
        {
          name: 'Net gelir',
          data: rows.map(row => row.netRevenue),
          color: netColor,
          areaColor: `${netColor}20`,
        },
        {
          name: 'İade',
          data: rows.map(row => row.refunded),
          color: refundColor,
          areaColor: `${refundColor}14`,
        },
      ],
    };
  });

  protected readonly hasRevenueTrend = computed(() =>
    this.revenueLineData().series.some(series => series.data.some(value => value > 0)),
  );

  protected readonly statusRows = computed<StatusRow[]>(() =>
    (this.summary()?.statusDistribution ?? []).map(status => ({
      ...status,
      label: this.translateStatus(status.status),
      tone: this.getPaymentStatusTone(status.status),
    })),
  );

  protected readonly statusDoughnutItems = computed<DoughnutItem[]>(() =>
    this.statusRows().map(status => ({
      label: status.label,
      value: status.count,
    })),
  );

  protected readonly planBarData = computed<BarChartInput>(() => {
    const plans = this.summary()?.planBreakdowns ?? [];
    const monthlyColor = cssVar('--chart-1', '#2563eb');
    const yearlyColor = cssVar('--chart-profit', '#16a34a');

    return {
      labels: plans.map(plan => plan.planDisplayName),
      series: [
        {
          name: 'Aylık gelir',
          data: plans.map(plan => plan.monthlyRevenue),
          color: monthlyColor,
        },
        {
          name: 'Yıllık gelir',
          data: plans.map(plan => plan.yearlyRevenue),
          color: yearlyColor,
        },
      ],
      valueAxes: [
        {
          labelMode: 'extremes',
          formatter: value => this.formatCompactCurrency(value),
        },
      ],
    };
  });

  protected readonly topPlanBreakdowns = computed(() =>
    [...(this.summary()?.planBreakdowns ?? [])]
      .sort((left, right) => right.totalRevenue - left.totalRevenue)
      .slice(0, 5),
  );

  protected readonly maxPlanRevenue = computed(() =>
    Math.max(...this.topPlanBreakdowns().map(plan => plan.totalRevenue), 0),
  );

  protected readonly subscriptionMetrics = computed(() => {
    const subscriptions = this.trends()?.subscriptions;
    if (!subscriptions) {
      return [];
    }

    return [
      {
        label: 'Aktif abonelik',
        value: this.formatNumber(subscriptions.active),
        tone: 'success',
      },
      {
        label: 'İptal bekleyen',
        value: this.formatNumber(subscriptions.cancelPending),
        tone: 'warning',
      },
      {
        label: 'İptal edilen',
        value: this.formatNumber(subscriptions.cancelled),
        tone: 'danger',
      },
      {
        label: 'Churn oranı',
        value: this.formatPercent(subscriptions.churnRatePercent),
        tone: 'danger',
      },
      {
        label: 'Yaklaşan yenileme',
        value: this.formatNumber(subscriptions.upcomingRenewals),
        tone: 'info',
      },
      {
        label: 'Aylık / yıllık',
        value: `${subscriptions.monthlyCount} / ${subscriptions.yearlyCount}`,
        tone: 'neutral',
      },
    ];
  });

  protected readonly cardBrandDoughnutItems = computed<DoughnutItem[]>(() =>
    (this.live()?.cardBrands ?? []).map(card => ({
      label: card.label?.toUpperCase() || 'Bilinmiyor',
      value: card.count,
    })),
  );

  protected readonly recentPayouts = computed(() => (this.live()?.recentPayouts ?? []).slice(0, 6));

  protected readonly topFailureCodes = computed(() =>
    (this.live()?.failureAnalysis.topFailureCodes ?? []).slice(0, 4),
  );

  ngOnInit(): void {
    this.loadSummaryAndTrends();
    this.loadStripeLive();
  }

  protected refreshAll(): void {
    this.loadingSummary.set(true);
    this.loadingTrends.set(true);
    this.loadingLive.set(true);
    this.loadSummaryAndTrends();
    this.loadStripeLive();
  }

  protected statusShare(count: number): number {
    const total = this.statusRows().reduce((sum, status) => sum + status.count, 0);
    return total > 0 ? (count / total) * 100 : 0;
  }

  protected planRevenueShare(plan: PlanBreakdown): number {
    const max = this.maxPlanRevenue();
    return max > 0 ? (plan.totalRevenue / max) * 100 : 0;
  }

  protected latestMonthlyRows(limit = 4): MonthlyRevenue[] {
    return [...(this.trends()?.monthlyRevenue ?? [])].slice(-limit).reverse();
  }

  protected formatCurrency(value: number | null | undefined, currency = 'TRY'): string {
    const numericValue = Number.isFinite(value) ? Number(value) : 0;
    const normalizedCurrency = (currency || 'TRY').toUpperCase() === 'TL'
      ? 'TRY'
      : (currency || 'TRY').toUpperCase();

    try {
      return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: normalizedCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numericValue);
    } catch {
      return `${numericValue.toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${normalizedCurrency}`;
    }
  }

  protected formatCompactCurrency(value: number | null | undefined): string {
    const numericValue = Number.isFinite(value) ? Number(value) : 0;
    return `₺${new Intl.NumberFormat('tr-TR', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(numericValue)}`;
  }

  protected formatPercent(value: number | null | undefined): string {
    const numericValue = Number.isFinite(value) ? Number(value) : 0;
    return `%${numericValue.toLocaleString('tr-TR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    })}`;
  }

  protected formatNumber(value: number | null | undefined): string {
    const numericValue = Number.isFinite(value) ? Number(value) : 0;
    return numericValue.toLocaleString('tr-TR');
  }

  protected formatDate(dateStr: string | null): string {
    if (!dateStr) {
      return '-';
    }

    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  protected translateStatus(status: string): string {
    const map: Record<string, string> = {
      Paid: 'Ödendi',
      Failed: 'Başarısız',
      Refunded: 'İade edildi',
      PartiallyRefunded: 'Kısmi iade',
      Uncollectible: 'Tahsil edilemez',
      Open: 'Açık',
      Void: 'İptal',
    };
    return map[status] || status;
  }

  protected translatePayoutStatus(status: string): string {
    const map: Record<string, string> = {
      paid: 'Ödendi',
      pending: 'Bekliyor',
      in_transit: 'Transferde',
      canceled: 'İptal',
      failed: 'Başarısız',
    };
    return map[status] || status;
  }

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      paid: 'rev-status--success',
      pending: 'rev-status--warning',
      in_transit: 'rev-status--info',
      canceled: 'rev-status--danger',
      failed: 'rev-status--danger',
    };
    return map[status] || 'rev-status--neutral';
  }

  private loadSummaryAndTrends(): void {
    this.setError('summary', undefined);
    this.setError('trends', undefined);

    forkJoin({
      summary: this.repo.getSummary(),
      trends: this.repo.getTrends(),
    }).subscribe({
      next: ({ summary, trends }) => {
        this.summary.set(summary);
        this.trends.set(trends);
        this.loadingSummary.set(false);
        this.loadingTrends.set(false);
      },
      error: () => {
        this.loadingSummary.set(false);
        this.loadingTrends.set(false);
        this.setError('summary', 'Gelir özeti yüklenemedi.');
        this.setError('trends', 'Gelir trendi yüklenemedi.');
      },
    });
  }

  private loadStripeLive(): void {
    this.setError('live', undefined);

    this.repo.getStripeLive().subscribe({
      next: data => {
        this.live.set(data);
        this.loadingLive.set(false);
      },
      error: () => {
        this.loadingLive.set(false);
        this.setError('live', 'Stripe canlı verileri yüklenemedi.');
      },
    });
  }

  private setError(key: keyof RevenueErrorState, message: string | undefined): void {
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

  private getPaymentStatusTone(status: string): StatusRow['tone'] {
    const map: Record<string, StatusRow['tone']> = {
      Paid: 'success',
      Failed: 'danger',
      Refunded: 'warning',
      PartiallyRefunded: 'warning',
      Uncollectible: 'danger',
      Open: 'info',
      Void: 'neutral',
    };
    return map[status] || 'neutral';
  }
}
