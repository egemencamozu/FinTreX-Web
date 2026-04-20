import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PortfolioRepository } from '../../../../../core/interfaces/portfolio.repository';
import { Portfolio as PortfolioModel } from '../../../../../core/models/portfolio.model';
import { PortfolioAsset } from '../../../../../core/models/asset.model';
import { HoldingsCardComponent, CardViewDirective } from '../../../../shared/components/holdings-card/holdings-card.component';
import { SegmentedControlComponent, SegmentedOption } from '../../../../shared/components/segmented-control/segmented-control.component';
import { LineChartComponent, LineChartInput } from '../../../../shared/components/charts/line-chart/line-chart.component';
import { DoughnutChartComponent, DoughnutItem } from '../../../../shared/components/charts/doughnut-chart/doughnut-chart.component';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import { finalize } from 'rxjs';
import { AlertService } from '../../../../../core/services/alert.service';

function cssVar(name: string): string {
  if (typeof window === 'undefined') return '';
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || '';
}

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [
    CommonModule,
    HoldingsCardComponent, CardViewDirective,
    SegmentedControlComponent, LineChartComponent, DoughnutChartComponent,
    KpiCardComponent
  ],
  templateUrl: './portfolio.html',
  styleUrl: './portfolio.scss',
})
export class Portfolio implements OnInit {
  private readonly portfolioRepo = inject(PortfolioRepository);
  private readonly alertService = inject(AlertService);
  
  private readonly lossColor = cssVar('--chart-loss');
  private readonly lossAlpha = this.lossColor + '33';

  readonly isLoading = signal<boolean>(true);
  readonly portfolios = signal<PortfolioModel[]>([]);
  readonly activePortfolioIndex = signal<number>(0);
  readonly activeRange = signal<string>('30d');
  
  // UI State Signals
  readonly showNewPortfolioModal = signal<boolean>(false);
  readonly showAddAssetModal = signal<boolean>(false);
  readonly editingAsset = signal<PortfolioAsset | null>(null);
  readonly isPortfolioDropdownOpen = signal<boolean>(false);

  readonly currentPortfolio = computed(() => 
    this.portfolios().length > this.activePortfolioIndex() 
      ? this.portfolios()[this.activePortfolioIndex()] 
      : null
  );

  // --- KPI Computed Signals ---
  readonly assetCount = computed(() => this.currentPortfolio()?.assets?.length || 0);

  readonly totalValue = computed(() => {
    const pf = this.currentPortfolio();
    if (!pf || !pf.assets) return 0;
    // Note: currentValue defaults to averageCost if not provided by backend
    return pf.assets.reduce((sum, a) => sum + (a.quantity * (a.currentValue || a.averageCost)), 0);
  });

  readonly totalCost = computed(() => {
    const pf = this.currentPortfolio();
    if (!pf || !pf.assets) return 0;
    return pf.assets.reduce((sum, a) => sum + (a.quantity * a.averageCost), 0);
  });

  readonly totalPnL = computed(() => this.totalValue() - this.totalCost());

  readonly totalPnLPercent = computed(() => {
    const cost = this.totalCost();
    if (cost === 0) return 0;
    return (this.totalPnL() / cost) * 100;
  });

  readonly viewOptions: SegmentedOption[] = [
    { id: 'history', label: 'History' },
    { id: 'allocation', label: 'Allocation' },
  ];

  readonly rangeOptions: SegmentedOption[] = [
    { id: '24h', label: '24h' },
    { id: '7d', label: '7d' },
    { id: '30d', label: '30d' },
    { id: '90d', label: '90d' },
    { id: 'all', label: 'All' },
  ];

  // Map real assets to Doughnut Chart items
  readonly allocationItems = computed<DoughnutItem[]>(() => {
    const pf = this.currentPortfolio();
    if (!pf || !pf.assets || pf.assets.length === 0) return [];

    const total = pf.assets.reduce((sum: number, a: PortfolioAsset) => sum + (a.quantity * a.averageCost), 0) || 1;
    
    return pf.assets.map((asset: PortfolioAsset) => ({
      label: asset.symbol,
      value: Number(((asset.quantity * asset.averageCost) / total * 100).toFixed(2))
    })).sort((a: DoughnutItem, b: DoughnutItem) => b.value - a.value);
  });

  // History data remains mocked for now as backend doesn't provide historical series yet
  readonly historyData: Record<string, LineChartInput> = {
    '24h': {
      labels: ['4PM', '6PM', '8PM', '10PM', '12AM', '4AM', '8AM', '12PM'],
      series: [{ data: [413000, 417000, 415000, 414000, 408000, 406000, 405000, 404000], color: this.lossColor, areaColor: this.lossAlpha }],
    },
    '7d': {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      series: [{ data: [400000, 410000, 415000, 412000, 408000, 405000, 404000], color: this.lossColor, areaColor: this.lossAlpha }],
    },
    '30d': {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      series: [{ data: [390000, 405000, 415000, 404000], color: this.lossColor, areaColor: this.lossAlpha }],
    },
    '90d': {
      labels: ['Jan', 'Feb', 'Mar'],
      series: [{ data: [380000, 400000, 404000], color: this.lossColor, areaColor: this.lossAlpha }],
    },
    all: {
      labels: ['2023', 'Q1', 'Q2', 'Q3', 'Q4', '2024'],
      series: [{ data: [300000, 340000, 370000, 390000, 400000, 404000], color: this.lossColor, areaColor: this.lossAlpha }],
    },
  };

  readonly activeChartData = computed(() =>
    this.historyData[this.activeRange()] ?? this.historyData['30d'],
  );

  ngOnInit(): void {
    this.loadPortfolios();
  }

  loadPortfolios(): void {
    this.isLoading.set(true);
    this.portfolioRepo.getMyPortfolios()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (data: PortfolioModel[]) => this.portfolios.set(data),
        error: (err: unknown) => {
          this.alertService.show('error', 'Portföyler yüklenirken bir hata oluştu');
          console.error('Failed to load portfolios', err);
        }
      });
  }

  // Action Handlers
  togglePortfolioDropdown(): void {
    this.isPortfolioDropdownOpen.update(v => !v);
  }

  selectPortfolio(index: number): void {
    this.activePortfolioIndex.set(index);
    this.isPortfolioDropdownOpen.set(false);
  }

  onPortfolioChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.activePortfolioIndex.set(parseInt(target.value, 10));
  }

  createNewPortfolio(name: string, description: string = ''): void {
    if (!name) return;
    this.portfolioRepo.createPortfolio({ name, description })
      .subscribe({
        next: () => {
          this.showNewPortfolioModal.set(false);
          this.loadPortfolios();
          this.alertService.show('success', 'Portföy başarıyla oluşturuldu');
        },
        error: (err: unknown) => {
          const message = err instanceof Error ? err.message : 'Portföy oluşturulamadı';
          this.alertService.show('error', message);
        }
      });
  }

  async deleteCurrentPortfolio(): Promise<void> {
    const pf = this.currentPortfolio();
    if (!pf) return;
    
    const confirmed = await this.alertService.confirm(`"${pf.name}" portföyünü silmek istediğinize emin misiniz?`);
    if (!confirmed) return;
    
    this.portfolioRepo.deletePortfolio(pf.id)
      .subscribe({
        next: () => {
          this.activePortfolioIndex.set(0);
          this.loadPortfolios();
          this.alertService.show('success', 'Portföy silindi');
        },
        error: (err: unknown) => {
          const message = err instanceof Error ? err.message : 'Portföy silinirken hata oluştu';
          this.alertService.show('error', message);
        }
      });
  }

  addAsset(symbol: string, assetName: string, assetType: string, quantity: number, averageCost: number, currency: string, acquiredAtUtc: string, notes: string): void {
    const pf = this.currentPortfolio();
    if (!pf) return;

    const editItem = this.editingAsset();

    if (editItem) {
      // Update logic
      this.portfolioRepo.updateAsset(editItem.id, {
        quantity,
        averageCost,
        notes: notes || undefined
      }).subscribe({
        next: () => {
          this.closeAssetModal();
          this.loadPortfolios();
          this.alertService.show('success', 'Varlık güncellendi');
        },
        error: (err: unknown) => {
          const message = err instanceof Error ? err.message : 'Güncelleme sırasında hata oluştu';
          this.alertService.show('error', message);
        }
      });
    } else {
      // Add logic
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
        }
      });
    }
  }

  async deleteAsset(assetId: number): Promise<void> {
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
      }
    });
  }

  editAsset(asset: PortfolioAsset): void {
    this.editingAsset.set(asset);
    this.showAddAssetModal.set(true);
  }

  closeAssetModal(): void {
    this.showAddAssetModal.set(false);
    this.editingAsset.set(null);
  }

  setRange(value: string): void {
    this.activeRange.set(value);
  }

  /**
   * Varlık tipine göre uygun Font Awesome ikon sınıfını döner.
   */
  getAssetIcon(assetType: string): string {
    switch (assetType) {
      case 'BIST': return 'fa-solid fa-building-columns';
      case 'Crypto': return 'fa-brands fa-bitcoin';
      case 'PreciousMetal': return 'fa-solid fa-gem';
      default: return 'fa-solid fa-coins';
    }
  }
}
