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
  @Input() currency: 'TRY' | 'USD' = 'TRY';
  @Input() usdTryRate = 0;
  /**
   * Satırdaki aksiyon modu:
   *  - `favorite`       → sadece yıldız (favoriye ekle/çıkar).
   *  - `favorite+alert` → yıldız + çan (alarm kur); piyasa verileri sayfası için.
   *  - `remove`         → sondaki "İşlemler" kolonunda çöp kutusu; watchlist için.
   */
  @Input() rowAction: 'favorite' | 'favorite+alert' | 'remove' = 'favorite';

  getPrice(item: MarketStockPrice): number {
    if (this.currency === 'USD' && this.usdTryRate > 0) return item.price / this.usdTryRate;
    return item.price;
  }

  @Output() favoriteToggle = new EventEmitter<string>();
  @Output() favoritePickerOpen = new EventEmitter<{ ticker: string; anchor: HTMLElement }>();
  @Output() rowRemove = new EventEmitter<string>();
  @Output() alertOpen = new EventEmitter<string>();
  @Output() sortChange = new EventEmitter<StockColSort | null>();

  onStarClick(ticker: string, ev: Event): void {
    ev.stopPropagation();
    // Favori modlarında watchlist popover açmak tercih edilir; geriye uyum için
    // `favoritePickerOpen` dinleyen yoksa parent basit `favoriteToggle` kullanabilir.
    if (this.rowAction === 'favorite' || this.rowAction === 'favorite+alert') {
      if (this.favoritePickerOpen.observed) {
        this.favoritePickerOpen.emit({
          ticker,
          anchor: ev.currentTarget as HTMLElement,
        });
        return;
      }
      this.favoriteToggle.emit(ticker);
      return;
    }
    // `remove` modunda yıldız kolonu yoktur; buraya düşülmesi beklenmez.
    this.favoriteToggle.emit(ticker);
  }

  onRowActionClick(ticker: string): void {
    if (this.rowAction === 'remove') this.rowRemove.emit(ticker);
    else this.favoriteToggle.emit(ticker);
  }

  onAlertClick(ticker: string, ev: Event): void {
    ev.stopPropagation();
    this.alertOpen.emit(ticker);
  }

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
