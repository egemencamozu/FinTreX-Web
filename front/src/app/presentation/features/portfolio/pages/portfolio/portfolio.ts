import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PortfolioRepository } from '../../../../../core/interfaces/portfolio.repository';
import { Portfolio as PortfolioModel } from '../../../../../core/models/portfolio.model';
import { PortfolioAsset } from '../../../../../core/models/asset.model';
import { HoldingsCardComponent, CardViewDirective } from '../../../../shared/components/holdings-card/holdings-card.component';
import { SegmentedControlComponent, SegmentedOption } from '../../../../shared/components/segmented-control/segmented-control.component';
import { LineChartComponent, LineChartInput } from '../../../../shared/components/charts/line-chart/line-chart.component';
import { DoughnutChartComponent, DoughnutItem } from '../../../../shared/components/charts/doughnut-chart/doughnut-chart.component';
import { finalize } from 'rxjs';

function cssVar(name: string): string {
  if (typeof window === 'undefined') return '';
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || (name === '--chart-loss' ? '#ff4d4f' : '');
}

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [
    CommonModule,
    HoldingsCardComponent, CardViewDirective,
    SegmentedControlComponent, LineChartComponent, DoughnutChartComponent,
  ],
  templateUrl: './portfolio.html',
  styleUrl: './portfolio.scss',
})
export class Portfolio implements OnInit {
  private readonly portfolioRepo = inject(PortfolioRepository);
  
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

  readonly currentPortfolio = computed(() => 
    this.portfolios().length > this.activePortfolioIndex() 
      ? this.portfolios()[this.activePortfolioIndex()] 
      : null
  );

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
        error: (err: any) => console.error('Failed to load portfolios', err)
      });
  }

  // Action Handlers
  onPortfolioChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.activePortfolioIndex.set(parseInt(target.value, 10));
  }

  createNewPortfolio(name: string): void {
    if (!name) return;
    this.portfolioRepo.createPortfolio({ name })
      .subscribe({
        next: () => {
          this.showNewPortfolioModal.set(false);
          this.loadPortfolios();
        },
        error: (err: any) => alert('Error creating portfolio: ' + err.message)
      });
  }

  deleteCurrentPortfolio(): void {
    const pf = this.currentPortfolio();
    if (!pf || !confirm(`Delete "${pf.name}" portfolio?`)) return;
    
    this.portfolioRepo.deletePortfolio(pf.id)
      .subscribe({
        next: () => {
          this.activePortfolioIndex.set(0);
          this.loadPortfolios();
        },
        error: (err: any) => alert('Error deleting portfolio: ' + err.message)
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
        },
        error: (err: any) => alert('Error updating asset: ' + err.message)
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
        },
        error: (err: any) => alert('Error adding asset: ' + err.message)
      });
    }
  }

  deleteAsset(assetId: number): void {
    if (!confirm('Remove this asset?')) return;
    this.portfolioRepo.deleteAsset(assetId).subscribe({
      next: () => this.loadPortfolios(),
      error: (err: any) => alert('Error removing asset: ' + err.message)
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
}
