import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SubscriptionRepository } from '../../../../../core/interfaces/subscription.repository';
import { UserSubscription } from '../../../../../core/models/subscription.model';

@Component({
  selector: 'app-success',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './success.html',
  styleUrl: './success.scss',
})
export class Success implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly subscriptionRepo = inject(SubscriptionRepository);
  private readonly destroyRef = inject(DestroyRef);

  readonly isVerifying = signal(true);
  readonly verified = signal<UserSubscription | null>(null);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const sessionId = this.route.snapshot.queryParamMap.get('session_id');
    if (!sessionId) {
      this.errorMessage.set('Geçersiz ödeme oturumu.');
      this.isVerifying.set(false);
      return;
    }

    this.subscriptionRepo.verifyCheckoutSession(sessionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sub) => {
          this.verified.set(sub);
          this.isVerifying.set(false);
        },
        error: () => {
          this.errorMessage.set('Ödeme doğrulanamadı. Birkaç saniye sonra tekrar deneyin.');
          this.isVerifying.set(false);
        },
      });
  }
}
