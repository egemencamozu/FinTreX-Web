import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';

export interface MarketTickerItem {
  label: string;
  value: string;
  changePercent: number | null;
  icon?: string;
}

@Component({
  selector: 'app-market-ticker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './market-ticker.component.html',
  styleUrl: './market-ticker.component.scss',
})
export class MarketTickerComponent {
  readonly items = input.required<MarketTickerItem[]>();
  readonly label = input('');

  readonly tickerItems = computed(() => {
    const items = this.items();
    return items.length ? Array.from({ length: 6 }, () => items).flat() : [];
  });

  formatChange(value: number): string {
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value.toFixed(2)}%`;
  }
}
