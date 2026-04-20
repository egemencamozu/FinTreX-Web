import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'marketChange',
  standalone: true,
})
export class MarketChangePipe implements PipeTransform {
  /**
   * Formats a percentage change value with arrow indicator.
   * Returns '— 0.00%' for zero, '▲ 1.23%' for positive, '▼ 1.23%' for negative.
   */
  transform(value: number): string {
    if (value === 0) return '— 0.00%';
    const arrow = value > 0 ? '▲' : '▼';
    return `${arrow} ${Math.abs(value).toFixed(2)}%`;
  }
}
