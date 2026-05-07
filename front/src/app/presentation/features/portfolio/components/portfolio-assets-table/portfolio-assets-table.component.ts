import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Portfolio } from '../../../../../core/models/portfolio.model';
import { MarketUiService } from '../../services/market-ui.service';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-portfolio-assets-table',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './portfolio-assets-table.component.html',
  styleUrl: './portfolio-assets-table.component.scss',
})
export class PortfolioAssetsTableComponent {
  @Input({ required: true }) assets: Portfolio['assets'] = [];
  @Input() onEdit?: (asset: Portfolio['assets'][0]) => void;
  @Input() onDelete?: (assetId: number) => void | Promise<void>;

  readonly ui = inject(MarketUiService);

  trackByAssetId(_: number, asset: Portfolio['assets'][0]): number {
    return asset.id;
  }

  getAssetIcon(assetType: string): string {
    const iconMap: { [key: string]: string } = {
      'BIST': 'fa-solid fa-building',
      'Crypto': 'fa-brands fa-bitcoin',
      'PreciousMetal': 'fa-solid fa-ring',
    };
    return iconMap[assetType] || 'fa-solid fa-coins';
  }

  getPnLChangeClass(asset: Portfolio['assets'][0]): { [key: string]: boolean } {
    const pnl = ((asset.currentValue || asset.averageCost) - asset.averageCost) * asset.quantity;
    return {
      'mk__up': pnl >= 0,
      'mk__down': pnl < 0,
    };
  }

  getPnLPercentValue(asset: Portfolio['assets'][0]): number {
    if (asset.averageCost <= 0) return 0;
    return (((asset.currentValue || asset.averageCost) - asset.averageCost) / asset.averageCost) * 100;
  }

  getPnLValue(asset: Portfolio['assets'][0]): number {
    return ((asset.currentValue || asset.averageCost) - asset.averageCost) * asset.quantity;
  }
}
