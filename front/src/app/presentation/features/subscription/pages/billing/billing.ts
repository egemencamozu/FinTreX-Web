import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PaymentHistoryRepository } from '../../../../../core/interfaces/payment-history.repository';
import { PaymentTransaction } from '../../../../../core/models/payment-transaction.model';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { PaymentCardComponent } from './payment-card/payment-card.component';

const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule, PaginatorComponent, PaymentCardComponent],
  templateUrl: './billing.html',
  styleUrl: './billing.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Billing implements OnInit {
  private readonly paymentRepo = inject(PaymentHistoryRepository);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly pageNumber = signal(1);
  readonly totalCount = signal(0);
  readonly payments = signal<PaymentTransaction[]>([]);

  readonly isLoading = signal(true);
  readonly isPortalLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly hasPayments = computed(() => this.payments().length > 0);

  ngOnInit(): void {
    this.load(this.pageNumber());
  }

  onPageChange(page: number): void {
    if (page === this.pageNumber()) return;
    this.pageNumber.set(page);
    this.load(page);
  }

  openPaymentPortal(): void {
    this.isPortalLoading.set(true);
    this.paymentRepo
      .createPortalSession()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ url }) => {
          this.isPortalLoading.set(false);
          window.location.href = url;
        },
        error: () => {
          this.isPortalLoading.set(false);
          this.errorMessage.set('Ödeme portalı açılamadı. Lütfen tekrar deneyin.');
        },
      });
  }

  private load(page: number): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.paymentRepo
      .getMyPayments(page, this.pageSize())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.payments.set(res.data ?? []);
          this.totalCount.set(res.totalCount ?? 0);
          this.pageNumber.set(res.pageNumber ?? page);
          this.isLoading.set(false);
        },
        error: () => {
          this.payments.set([]);
          this.totalCount.set(0);
          this.errorMessage.set('Ödeme geçmişi yüklenemedi. Lütfen tekrar deneyin.');
          this.isLoading.set(false);
        },
      });
  }
}
