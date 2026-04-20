import { Component, Input, Output, EventEmitter, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarketStockPrice } from '../../../../../core/models/market-data.model';
import { MarketUiService } from '../../services/market-ui.service';
import { MarketAssetCellComponent } from '../market-asset-cell/market-asset-cell.component';
import { MarketChangePipe } from '../../../../shared/pipes/market-change.pipe';
import { MarketPricePipe } from '../../../../shared/pipes/market-price.pipe';
import { CompactNumberPipe } from '../../../../shared/pipes/compact-number.pipe';

type StockSortCol = 'price' | 'change' | 'volume';
type SortDir = 'asc' | 'desc';

export interface StockColSort {
  col: StockSortCol;
  dir: SortDir;
}

@Component({
  selector: 'app-market-bist-table',
  standalone: true,
  imports: [CommonModule, MarketAssetCellComponent, MarketChangePipe, MarketPricePipe, CompactNumberPipe],
  templateUrl: './market-bist-table.component.html',
  styleUrl: './market-bist-table.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class MarketBistTableComponent {
  @Input({ required: true }) stocks: MarketStockPrice[] = [];
  @Input({ required: true }) favorites!: Set<string>;
  @Input() colSort: StockColSort | null = null;

  @Output() favoriteToggle = new EventEmitter<string>();
  @Output() sortChange = new EventEmitter<StockColSort | null>();

  readonly ui = inject(MarketUiService);

  trackByTicker(_: number, item: MarketStockPrice): string {
    return item.ticker;
  }

  formatTicker(ticker: string): string {
    return ticker.replace('.IS', '');
  }

  sortByDir(col: StockSortCol, dir: SortDir): void {
    if (this.colSort?.col === col && this.colSort?.dir === dir) {
      this.sortChange.emit(null);
      return;
    }

    this.sortChange.emit({ col, dir });
  }

  isSortActive(col: StockSortCol, dir: SortDir): boolean {
    return this.colSort?.col === col && this.colSort?.dir === dir;
  }
}
