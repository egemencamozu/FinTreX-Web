import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { BillingPeriod, SubscriptionRepository } from '../../../../../core/interfaces/subscription.repository';
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // ── Types for template ───────────────────────────────────────────────────
  readonly tierEnum = SubscriptionTier;
  readonly statusEnum = SubscriptionStatus;

  // ── State ────────────────────────────────────────────────────────────────
  readonly plans = signal<SubscriptionPlan[]>([]);
  readonly currentSubscription = signal<UserSubscription | null>(null);
  readonly billingPeriod = signal<BillingPeriod>('monthly');

  readonly isLoading = signal(true);
  readonly isProcessing = signal(false); // upgrade/cancel in flight
  readonly targetPlanId = signal<number | null>(null); // spinner on a specific card
  readonly errorMessage = signal<string | null>(null);

  readonly paymentModalState = signal<'verifying' | 'success' | 'cancel' | 'error' | null>(null);
  readonly paymentModalMessage = signal<string | null>(null);
  readonly showCancelConfirm = signal(false);

  // ── Computed ─────────────────────────────────────────────────────────────

  readonly activePlanTier = computed(() => {
    const sub = this.currentSubscription();
    if (!sub || sub.status !== SubscriptionStatus.ACTIVE) return null;
    return sub.plan.tier;
  });

  readonly currentPlanName = computed(() => {
    const sub = this.currentSubscription();
    return sub?.plan?.displayName ?? null;
  });

  readonly isYearly = computed(() => this.billingPeriod() === 'yearly');

  /** Kullanıcının mevcut aboneliği zaten yıllık mı? */
  readonly isCurrentSubYearly = computed(() => {
    const sub = this.currentSubscription();
    if (!sub) return false;

    // Prefer explicit billingPeriod from API
    if (sub.billingPeriod) return sub.billingPeriod === 'yearly';

    // Fallback: infer from period dates (>35 days = yearly)
    if (sub.startedAtUtc && sub.currentPeriodEndUtc) {
      const start = new Date(sub.startedAtUtc).getTime();
      const end = new Date(sub.currentPeriodEndUtc).getTime();
      const days = (end - start) / (1000 * 60 * 60 * 24);
      return days > 35;
    }

    return false;
  });

  // ── Downgrade Guard ─────────────────────────────────────────────────────
  /** Alt seviye → her zaman engelle. Aynı seviye → yıllık seçildiyse izin ver, değilse engelle. */
  isDowngradeOrSame(planTier: SubscriptionTier): boolean {
    const currentTier = this.activePlanTier();
    if (!currentTier) return false;

    const targetOrder = this.getTierOrder(planTier);
    const currentOrder = this.getTierOrder(currentTier);

    if (targetOrder < currentOrder) return true; // alt seviye → engelle
    if (targetOrder === currentOrder && !this.isYearly()) return true; // aynı seviye + aylık → engelle
    return false; // üst seviye veya aynı seviye + yıllık → izin ver
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.checkPaymentRedirects();
    this.loadData();
  }

  private checkPaymentRedirects(): void {
    const url = this.router.url;
    if (url.includes('/success')) {
      const sessionId = this.route.snapshot.queryParamMap.get('session_id');
      if (sessionId) {
        this.paymentModalState.set('verifying');
        this.subscriptionRepo.verifyCheckoutSession(sessionId)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (sub) => {
              this.paymentModalState.set('success');
              this.paymentModalMessage.set('Ödemeniz başarıyla alındı ve aboneliğiniz başlatıldı.');
              this.currentSubscription.set(sub);
              this.loadData();
            },
            error: () => {
              this.paymentModalState.set('error');
              this.paymentModalMessage.set('Ödeme doğrulanamadı. Lütfen destek ekibi ile iletişime geçin.');
            }
          });
      } else {
        this.paymentModalState.set('error');
        this.paymentModalMessage.set('Geçersiz ödeme oturumu.');
      }
    } else if (url.includes('/cancel')) {
      this.paymentModalState.set('cancel');
      this.paymentModalMessage.set('Ödeme işlemi tamamlanamadı ve iptal edildi.');
    }
  }

  closePaymentModal(): void {
    this.paymentModalState.set(null);
    this.router.navigate(['/app/subscription/manage'], { replaceUrl: true });
  }

  // ── Data Loading ─────────────────────────────────────────────────────────

  private loadData(): void {
    this.isLoading.set(true);

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
    // Prevent if it's already the active plan (but allow yearly switch for same plan if not already yearly)
    if (currentSub?.plan?.id === planId && currentSub.status === SubscriptionStatus.ACTIVE) {
      if (!this.isYearly() || this.isCurrentSubYearly()) return;
    }

    const plan = this.plans().find((p) => p.id === planId);
    if (!plan) return;

    // Prevent downgrade or same-tier selection
    if (this.isDowngradeOrSame(plan.tier)) return;

    // Free tier downgrade still goes through the local upgrade endpoint.
    if (plan.tier === SubscriptionTier.Default) {
      this.targetPlanId.set(planId);
      this.isProcessing.set(true);
      this.subscriptionRepo.upgradePlan(planId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.loadData();
            this.isProcessing.set(false);
            this.targetPlanId.set(null);
          },
          error: () => {
            this.errorMessage.set('Plan değiştirilemedi.');
            this.isProcessing.set(false);
            this.targetPlanId.set(null);
          },
        });
      return;
    }

    // Paid plans → Stripe Checkout (hosted) redirect.
    this.targetPlanId.set(planId);
    this.isProcessing.set(true);
    this.errorMessage.set(null);

    this.subscriptionRepo.createCheckoutSession(planId, this.billingPeriod())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ checkoutUrl }) => {
          window.location.href = checkoutUrl;
        },
        error: () => {
          this.errorMessage.set('Ödeme oturumu başlatılamadı. Lütfen tekrar deneyin.');
          this.isProcessing.set(false);
          this.targetPlanId.set(null);
        }
      });
  }

  confirmCancelSubscription(): void {
    const sub = this.currentSubscription();
    if (!sub || sub.plan.tier === SubscriptionTier.Default || sub.cancelledAtUtc) {
      return;
    }

    this.showCancelConfirm.set(false);
    this.isProcessing.set(true);
    this.subscriptionRepo.cancelSubscription()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadData();
          this.isProcessing.set(false);
        },
        error: () => {
          this.errorMessage.set('Abonelik iptal edilemedi.');
          this.isProcessing.set(false);
        }
      });
  }

  getPriceDisplay(plan: SubscriptionPlan): number {
    if (this.billingPeriod() === 'yearly') {
      // Show yearly amount divided by 12 so the headline price still reads "/ ay"
      // but reflects the discounted yearly rate. Falls back to monthly if no
      // yearly price configured for this plan.
      if (plan.yearlyPriceTRY > 0) {
        return Math.round(plan.yearlyPriceTRY / 12);
      }
    }
    return plan.monthlyPriceTRY;
  }

  getYearlyTotal(plan: SubscriptionPlan): number {
    return plan.yearlyPriceTRY;
  }

  getYearlySavingsPercent(plan: SubscriptionPlan): number | null {
    if (plan.monthlyPriceTRY <= 0 || plan.yearlyPriceTRY <= 0) return null;
    const fullYear = plan.monthlyPriceTRY * 12;
    if (fullYear <= 0) return null;
    const saved = ((fullYear - plan.yearlyPriceTRY) / fullYear) * 100;
    return saved > 0 ? Math.round(saved) : null;
  }

  toggleBillingPeriod(): void {
    this.billingPeriod.update((p) => (p === 'monthly' ? 'yearly' : 'monthly'));
  }

  setBillingPeriod(period: BillingPeriod): void {
    this.billingPeriod.set(period);
  }

  isPlanActive(planId: number): boolean {
    const sub = this.currentSubscription();
    return sub?.plan?.id === planId;
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
