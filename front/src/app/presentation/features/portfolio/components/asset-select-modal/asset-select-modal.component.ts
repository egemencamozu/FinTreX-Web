import {
  Component, EventEmitter, Input, OnChanges, Output, signal, computed, inject, SimpleChanges, ViewChild, ElementRef, AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupportedAssetsService } from '../../../../../core/services/supported-assets.service';
import { BistSymbol, CryptoSymbol, PreciousMetalSymbol } from '../../../../../core/models/supported-asset.model';

export interface SelectedAsset {
  symbol: string;
  name: string;
  assetType: string;
}

@Component({
  selector: 'app-asset-select-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './asset-select-modal.component.html',
  styleUrl: './asset-select-modal.component.scss',
})
export class AssetSelectModalComponent implements OnChanges, AfterViewInit {
  @Input() assetType: string = 'BIST';
  @Input() visible: boolean = false;
  @Input() embedded: boolean = false;
  @Input() embeddedHeight: number | null = null;
  @Input() embeddedMaxHeight = 320;
  @Input() set excludedSymbols(value: string[] | null | undefined) {
    this.excludedSymbolsInput.set(
      (value ?? []).map(symbol => (symbol ?? '').trim().toUpperCase()),
    );
  }
  @Output() selected = new EventEmitter<SelectedAsset>();
  @Output() cancelled = new EventEmitter<void>();
  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  private readonly supportedAssets = inject(SupportedAssetsService);

  readonly searchQuery = signal('');
  readonly bistSymbols = signal<BistSymbol[]>([]);
  readonly cryptoSymbols = signal<CryptoSymbol[]>([]);
  readonly preciousMetalSymbols = signal<PreciousMetalSymbol[]>([]);
  readonly isLoading = signal(false);
  private readonly excludedSymbolsInput = signal<string[]>([]);

  readonly excludedSymbolSet = computed(
    () => new Set(this.excludedSymbolsInput()),
  );

  readonly filteredBist = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const excluded = this.excludedSymbolSet();
    const items = this.bistSymbols().filter(item => {
      const ticker = item.ticker.toUpperCase();
      const plainTicker = item.ticker.replace(/\.IS$/i, '').toUpperCase();
      return !excluded.has(ticker) && !excluded.has(plainTicker);
    });
    if (!q) return items;
    return items.filter(s =>
      s.ticker.toLowerCase().includes(q) ||
      s.companyName.toLowerCase().includes(q) ||
      s.sector?.toLowerCase().includes(q)
    );
  });

  readonly filteredCrypto = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const excluded = this.excludedSymbolSet();
    const items = this.cryptoSymbols().filter(
      item => !excluded.has(item.baseAsset.toUpperCase()),
    );
    if (!q) return items;
    return items.filter(s =>
      s.baseAsset.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.symbol.toLowerCase().includes(q)
    );
  });

  readonly filteredPreciousMetals = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const excluded = this.excludedSymbolSet();
    const items = this.preciousMetalSymbols().filter(
      item => !excluded.has(item.symbol.toUpperCase()),
    );
    if (!q) return items;

    return items.filter(item =>
      item.symbol.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q)
    );
  });

  ngOnChanges(changes: SimpleChanges): void {
    const becameVisible =
      changes['visible']?.currentValue === true &&
      changes['visible']?.previousValue !== true;
    const assetTypeChangedWhileVisible =
      !!changes['assetType'] && this.visible;

    if (becameVisible || assetTypeChangedWhileVisible) {
      this.searchQuery.set('');
      this.loadSymbols();
      if (becameVisible) {
        setTimeout(() => this.searchInputRef?.nativeElement.focus(), 50);
      }
    }
  }

  ngAfterViewInit(): void {
    if (this.visible) {
      setTimeout(() => this.searchInputRef?.nativeElement.focus(), 50);
    }
  }

  private loadSymbols(): void {
    if (this.assetType === 'BIST' && this.bistSymbols().length === 0) {
      this.isLoading.set(true);
      this.supportedAssets.getBistSymbols().subscribe(items => {
        this.bistSymbols.set(items);
        this.isLoading.set(false);
      });
    } else if (this.assetType === 'Crypto' && this.cryptoSymbols().length === 0) {
      this.isLoading.set(true);
      this.supportedAssets.getCryptoSymbols().subscribe(items => {
        this.cryptoSymbols.set(items);
        this.isLoading.set(false);
      });
    } else if (this.assetType === 'PreciousMetal' && this.preciousMetalSymbols().length === 0) {
      this.isLoading.set(true);
      this.supportedAssets.getPreciousMetalSymbols().subscribe(items => {
        this.preciousMetalSymbols.set(items);
        this.isLoading.set(false);
      });
    }
  }

  selectBist(item: BistSymbol): void {
    const ticker = item.ticker.replace(/\.IS$/i, '');
    this.selected.emit({ symbol: ticker, name: item.companyName, assetType: 'BIST' });
  }

  selectCrypto(item: CryptoSymbol): void {
    this.selected.emit({ symbol: item.baseAsset, name: item.name || item.baseAsset, assetType: 'Crypto' });
  }

  selectPreciousMetal(item: PreciousMetalSymbol): void {
    this.selected.emit({
      symbol: item.symbol,
      name: item.name || item.symbol,
      assetType: 'PreciousMetal',
    });
  }

  getPreciousMetalAvatar(symbol: string): string {
    const normalized = (symbol ?? '').trim().toUpperCase();
    if (normalized === 'XAU') return 'Au';
    if (normalized === 'XAG') return 'Ag';
    if (normalized === 'XPT') return 'Pt';
    return normalized.slice(0, 2);
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
