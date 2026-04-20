import { Component, Input, ViewEncapsulation, inject } from '@angular/core';
import { MarketUiService } from '../../services/market-ui.service';

@Component({
  selector: 'app-market-asset-cell',
  standalone: true,
  templateUrl: './market-asset-cell.component.html',
  styleUrl: './market-asset-cell.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class MarketAssetCellComponent {
  /** Primary symbol shown in bold (e.g. 'AKBNK', 'BTC') */
  @Input({ required: true }) symbol!: string;
  /** Secondary sub-label shown below symbol (e.g. company name, coin full name) */
  @Input() subLabel = '';
  /** Raw identifier used to derive avatar color and logo URL (defaults to symbol) */
  @Input() avatarKey = '';
  /** When true, tries to load a crypto logo from CDN */
  @Input() showLogo = false;
  /** When true, renders the gold 'Au' avatar */
  @Input() isGold = false;

  readonly ui = inject(MarketUiService);

  get resolvedAvatarKey(): string {
    return this.avatarKey || this.symbol;
  }
}
