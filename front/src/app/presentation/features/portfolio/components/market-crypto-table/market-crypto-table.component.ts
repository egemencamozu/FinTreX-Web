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
  @Input() currency: 'USD' | 'TRY' = 'USD';
  @Input() usdTryRate = 0;
  /**
   * Satırdaki aksiyon modu:
   *  - `favorite`       → sadece yıldız.
   *  - `favorite+alert` → yıldız + çan (alarm kur).
   *  - `remove`         → sondaki kolonda çöp kutusu.
   */
  @Input() rowAction: 'favorite' | 'favorite+alert' | 'remove' = 'favorite';

  getPrice(item: MarketCryptoPrice): number {
    if (this.currency === 'TRY') {
      return item.priceTry > 0 ? item.priceTry : item.priceUsdt * this.usdTryRate;
    }
    return item.priceUsdt;
  }

  getMarketCap(item: MarketCryptoPrice): number | null {
    if (item.marketCapUsdt === null) return null;
    if (this.currency === 'TRY') {
      return this.usdTryRate > 0 ? item.marketCapUsdt * this.usdTryRate : item.marketCapUsdt;
    }
    return item.marketCapUsdt;
  }

  getVolume24h(item: MarketCryptoPrice): number {
    if (this.currency === 'TRY') {
      return this.usdTryRate > 0 ? item.volume24h * this.usdTryRate : item.volume24h;
    }
    return item.volume24h;
  }

  getCurrencySymbol(): string {
    return this.currency === 'TRY' ? '₺' : '$';
  }

  @Output() favoriteToggle = new EventEmitter<string>();
  @Output() favoritePickerOpen = new EventEmitter<{ symbol: string; anchor: HTMLElement }>();
  @Output() rowRemove = new EventEmitter<string>();
  @Output() alertOpen = new EventEmitter<string>();
  @Output() sortChange = new EventEmitter<CryptoColSort | null>();

  readonly ui = inject(MarketUiService);

  onStarClick(symbol: string, ev: Event): void {
    ev.stopPropagation();
    if (this.rowAction === 'favorite' || this.rowAction === 'favorite+alert') {
      if (this.favoritePickerOpen.observed) {
        this.favoritePickerOpen.emit({
          symbol,
          anchor: ev.currentTarget as HTMLElement,
        });
        return;
      }
      this.favoriteToggle.emit(symbol);
      return;
    }
    this.favoriteToggle.emit(symbol);
  }

  onRowActionClick(symbol: string): void {
    if (this.rowAction === 'remove') this.rowRemove.emit(symbol);
    else this.favoriteToggle.emit(symbol);
  }

  onAlertClick(symbol: string, ev: Event): void {
    ev.stopPropagation();
    this.alertOpen.emit(symbol);
  }

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

