import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SubscriptionRepository } from '../../../../../core/interfaces/subscription.repository';
import { PlanFeature, SubscriptionPlan, UserSubscription } from '../../../../../core/models/subscription.model';
import { SubscriptionTier } from '../../../../../core/enums/subscription-tier.enum';
import { SubscriptionStatus } from '../../../../../core/enums/subscription-status.enum';

@Component({
  selector: 'app-manage',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './manage.html',
  styleUrl: './manage.scss',
})
export class Manage implements OnInit {
  private readonly subscriptionRepo = inject(SubscriptionRepository);
  private readonly destroyRef = inject(DestroyRef);

  // ── Types for template ───────────────────────────────────────────────────
  readonly tierEnum = SubscriptionTier;
  readonly statusEnum = SubscriptionStatus;

  // ── State ────────────────────────────────────────────────────────────────
  readonly plans = signal<SubscriptionPlan[]>([]);
  readonly currentSubscription = signal<UserSubscription | null>(null);

  readonly isLoading = signal(true);
  readonly isProcessing = signal(false); // Used for loading states during upgrade/cancel
  readonly targetPlanId = signal<number | null>(null); // To show spinner on the specific card

  // ── Computed ─────────────────────────────────────────────────────────────

  readonly activePlanTier = computed(() => {
    const sub = this.currentSubscription();
    if (!sub || sub.status !== SubscriptionStatus.ACTIVE) return null;
    return sub.subscriptionPlan.tier;
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadData();
  }

  // ── Data Loading ─────────────────────────────────────────────────────────

  private loadData(): void {
    this.isLoading.set(true);

    // Fetch both plans and current subscription
    // Normally you'd use forkJoin, doing sequentially here for simplicity or forkJoin
    let plansLoaded = false;
    let subLoaded = false;

    const checkDone = () => {
      if (plansLoaded && subLoaded) {
        this.isLoading.set(false);
      }
    };

    this.subscriptionRepo.getAvailablePlans()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (plans) => {
          // 1. Sort plans by role-based hierarchy
          let sortedPlans = [...plans].sort((a, b) => this.getTierOrder(a.tier) - this.getTierOrder(b.tier));

          // 2. Identify the global pool from all fetched plans
          const pool = new Set<string>();
          sortedPlans.forEach(p => {
            p.features?.forEach(f => pool.add(typeof f === 'string' ? f : f.name));
          });
          const poolArray = Array.from(pool);

          // 3. Normalize EVERY plan immediately so pricing cards show everything correctly
          const synchronizedPlans = sortedPlans.map(plan => {
            const normalizedFeatures = poolArray.map(name => {
              const existing = plan.features?.find(f => (typeof f === 'string' ? f : f.name) === name);
              if (existing) {
                // If explicitly in plan (string or object), normalize it
                return typeof existing === 'string' ? { name: existing, status: 'included' } : { ...existing };
              } else {
                // SMART GUESS: find the LOWEST tier that has this feature as 'included'
                const sourcePlan = sortedPlans.find(sp => sp.features?.some(f => {
                  const isMatch = (typeof f === 'string' ? f : f.name) === name;
                  const isIncluded = typeof f === 'string' || f.status === 'included';
                  return isMatch && isIncluded;
                }));

                const sourceTier = sourcePlan ? this.getTierOrder(sourcePlan.tier) : 99;
                const targetTier = this.getTierOrder(plan.tier);
                // Hierarchy rule: If target tier >= source tier (where feature starts), it's included
                const status: 'included' | 'excluded' | 'hidden' = targetTier >= sourceTier ? 'included' : 'excluded';
                return { name, status };
              }
            });

            return { ...plan, features: normalizedFeatures as PlanFeature[] };
          });

          this.plans.set(synchronizedPlans);
          plansLoaded = true;
          checkDone();
        },
        error: () => {
          plansLoaded = true;
          checkDone();
        }
      });

    this.subscriptionRepo.getMySubscription()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sub) => {
          this.currentSubscription.set(sub);
          subLoaded = true;
          checkDone();
        },
        error: () => {
          subLoaded = true;
          checkDone();
        }
      });
  }

  // ── Actions ──────────────────────────────────────────────────────────────


  upgradePlan(planId: number): void {
    const currentSub = this.currentSubscription();
    // Prevent if it's already the active plan
    if (currentSub?.subscriptionPlanId === planId && currentSub.status === SubscriptionStatus.ACTIVE) {
      return;
    }

    this.isProcessing.set(true);
    this.targetPlanId.set(planId);

    this.subscriptionRepo.upgradePlan(planId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedSub) => {
          this.currentSubscription.set(updatedSub);
          this.isProcessing.set(false);
          this.targetPlanId.set(null);
        },
        error: () => {
          this.isProcessing.set(false);
          this.targetPlanId.set(null);
        }
      });
  }

  cancelSubscription(): void {
    const sub = this.currentSubscription();
    if (!sub || sub.subscriptionPlan.tier === SubscriptionTier.Default || sub.cancelledAtUtc) {
      return;
    }

    this.isProcessing.set(true);
    this.subscriptionRepo.cancelSubscription()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // Refresh data to show cancelled status and end date
          this.loadData();
          this.isProcessing.set(false);
        },
        error: () => {
          this.isProcessing.set(false);
        }
      });
  }

  getPriceDisplay(plan: SubscriptionPlan): number {
    return plan.monthlyPriceTRY;
  }

  isPlanActive(planId: number): boolean {
    const sub = this.currentSubscription();
    return sub?.subscriptionPlanId === planId;
  }

  private getTierOrder(tier: SubscriptionTier): number {
    switch (tier) {
      case SubscriptionTier.Default: return 0;
      case SubscriptionTier.Premium: return 1;
      case SubscriptionTier.Ultra: return 2;
      default: return 0;
    }
  }
}
