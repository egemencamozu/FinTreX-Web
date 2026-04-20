import { Component, Input, Output, EventEmitter, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarketCryptoPrice } from '../../../../../core/models/market-data.model';
import { MarketUiService } from '../../services/market-ui.service';
import { MarketAssetCellComponent } from '../market-asset-cell/market-asset-cell.component';
import { MarketChangePipe } from '../../../../shared/pipes/market-change.pipe';
import { MarketPricePipe } from '../../../../shared/pipes/market-price.pipe';
import { CompactNumberPipe } from '../../../../shared/pipes/compact-number.pipe';

type CryptoSortCol = 'price' | 'change1h' | 'change4h' | 'change24h' | 'marketCap' | 'volume';
type SortDir = 'asc' | 'desc';

export interface CryptoColSort {
  col: CryptoSortCol;
  dir: SortDir;
}

@Component({
  selector: 'app-market-crypto-table',
  standalone: true,
  imports: [CommonModule, MarketAssetCellComponent, MarketChangePipe, MarketPricePipe, CompactNumberPipe],
  templateUrl: './market-crypto-table.component.html',
  styleUrl: './market-crypto-table.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class MarketCryptoTableComponent {
  @Input({ required: true }) cryptos: MarketCryptoPrice[] = [];
  @Input({ required: true }) favorites!: Set<string>;
  @Input() colSort: CryptoColSort | null = null;

  @Output() favoriteToggle = new EventEmitter<string>();
  @Output() sortChange = new EventEmitter<CryptoColSort | null>();

  readonly ui = inject(MarketUiService);

  trackBySymbol(_: number, item: MarketCryptoPrice): string {
    return item.symbol;
  }

  sortByDir(col: CryptoSortCol, dir: SortDir): void {
    if (this.colSort?.col === col && this.colSort?.dir === dir) {
      this.sortChange.emit(null);
      return;
    }

    this.sortChange.emit({ col, dir });
  }

  isSortActive(col: CryptoSortCol, dir: SortDir): boolean {
    return this.colSort?.col === col && this.colSort?.dir === dir;
  }
}

