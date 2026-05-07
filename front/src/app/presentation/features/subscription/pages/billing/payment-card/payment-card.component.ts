import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PaymentStatus } from '../../../../../../core/enums/payment-status.enum';
import { PaymentTransaction } from '../../../../../../core/models/payment-transaction.model';

type StatusVariant = 'success' | 'danger' | 'warning' | 'muted';

@Component({
  selector: 'app-payment-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-card.component.html',
  styleUrl: './payment-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentCardComponent {
  readonly payment = input.required<PaymentTransaction>();

  readonly currencyCode = computed(() => (this.payment().currency ?? 'TRY').toUpperCase());
  readonly statusLabel = computed(() => this.mapStatusLabel(this.payment().status));
  readonly statusVariant = computed<StatusVariant>(() => this.mapStatusVariant(this.payment().status));

  readonly billingPeriodLabel = computed(() => {
    const bp = (this.payment().billingPeriod ?? '').toLowerCase();
    if (bp === 'yearly') return 'Yıllık';
    if (bp === 'monthly') return 'Aylık';
    return null;
  });

  readonly effectiveDate = computed(() => this.payment().paidAtUtc ?? this.payment().createdAtUtc);

  private mapStatusLabel(status: PaymentStatus): string {
    switch (status) {
      case PaymentStatus.PAID:               return 'Ödendi';
      case PaymentStatus.FAILED:             return 'Başarısız';
      case PaymentStatus.OPEN:               return 'Bekliyor';
      case PaymentStatus.UNCOLLECTIBLE:      return 'Tahsil Edilemedi';
      case PaymentStatus.REFUNDED:           return 'İade Edildi';
      case PaymentStatus.PARTIALLY_REFUNDED: return 'Kısmen İade';
      case PaymentStatus.VOID:               return 'İptal';
      default:                               return status;
    }
  }

  private mapStatusVariant(status: PaymentStatus): StatusVariant {
    switch (status) {
      case PaymentStatus.PAID:               return 'success';
      case PaymentStatus.FAILED:
      case PaymentStatus.UNCOLLECTIBLE:      return 'danger';
      case PaymentStatus.REFUNDED:
      case PaymentStatus.PARTIALLY_REFUNDED: return 'warning';
      default:                               return 'muted';
    }
  }
}
