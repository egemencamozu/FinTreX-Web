import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SubscriptionRepository } from '../../../../../core/interfaces/subscription.repository';
import { SubscriptionPlan, UserSubscription } from '../../../../../core/models/subscription.model';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './subscription.html',
  styleUrl: './subscription.scss',
})
export class Subscription implements OnInit {
  private readonly subRepo = inject(SubscriptionRepository);

  readonly isLoading = signal<boolean>(true);
  readonly plans = signal<SubscriptionPlan[]>([]);
  readonly mySubscription = signal<UserSubscription | null>(null);

  readonly activePlanId = computed(() => this.mySubscription()?.subscriptionPlanId);

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    // Parallel load
    this.subRepo.getAvailablePlans().subscribe({
      next: (plans: SubscriptionPlan[]) => this.plans.set(plans),
      error: (err: any) => console.error('Failed to load plans', err)
    });

    this.subRepo.getMySubscription().pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: (sub) => this.mySubscription.set(sub),
      error: (err) => console.error('Failed to load my subscription', err)
    });
  }

  upgrade(planId: number): void {
    if (planId === this.activePlanId()) return;

    this.isLoading.set(true);
    this.subRepo.upgradePlan(planId).subscribe({
      next: (newSub) => {
        this.mySubscription.set(newSub);
        this.isLoading.set(false);
        alert('Plan upgraded successfully!');
      },
      error: (err) => {
        this.isLoading.set(false);
        alert('Upgrade failed: ' + err.message);
      }
    });
  }

  cancelSub(): void {
    if (!confirm('Are you sure you want to cancel your subscription?')) return;
    
    this.isLoading.set(true);
    this.subRepo.cancelSubscription().subscribe({
      next: () => {
        this.loadData();
        alert('Subscription cancelled.');
      },
      error: (err) => {
        this.isLoading.set(false);
        alert('Cancellation failed: ' + err.message);
      }
    });
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(price);
  }
}
