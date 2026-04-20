import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'marketPrice',
  standalone: true,
})
export class MarketPricePipe implements PipeTransform {
  transform(value: number, currency: 'TRY' | 'USD', digits = 2): string {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  }
}
