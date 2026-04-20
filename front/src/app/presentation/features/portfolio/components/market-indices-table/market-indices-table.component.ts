import { Component, Input, Output, EventEmitter, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarketIndexPrice } from '../../../../../core/models/market-data.model';
import { MarketUiService } from '../../services/market-ui.service';
import { MarketAssetCellComponent } from '../market-asset-cell/market-asset-cell.component';
import { MarketChangePipe } from '../../../../shared/pipes/market-change.pipe';
import { CompactNumberPipe } from '../../../../shared/pipes/compact-number.pipe';

@Component({
  selector: 'app-market-indices-table',
  standalone: true,
  imports: [CommonModule, MarketAssetCellComponent, MarketChangePipe, CompactNumberPipe],
  templateUrl: './market-indices-table.component.html',
  styleUrl: './market-indices-table.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class MarketIndicesTableComponent {
  @Input({ required: true }) indices: MarketIndexPrice[] = [];
  @Input({ required: true }) favorites!: Set<string>;
  @Output() favoriteToggle = new EventEmitter<string>();

  readonly ui = inject(MarketUiService);

  trackByTicker(_: number, item: MarketIndexPrice): string {
    return item.ticker;
  }

  formatTicker(ticker: string): string {
    return ticker.replace('.IS', '');
  }
}
