import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { AdminSection } from '../../models/admin-section.model';
import { SubscriptionPlan, UpdateSubscriptionPlanDto, PlanFeature } from '../../../../../core/models/subscription.model';
import { SubscriptionRepository } from '../../../../../core/interfaces/subscription.repository';
import { SubscriptionTier } from '../../../../../core/enums/subscription-tier.enum';

@Component({
  selector: 'app-admin-subscriptions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-subscriptions.page.html',
  styleUrl: './admin-subscriptions.page.scss',
})
export class AdminSubscriptionsPage implements OnInit {
  protected loading = false;
  protected errorMessage: string | null = null;
  protected successMessage: string | null = null;
  protected plans: SubscriptionPlan[] = [];

  protected editingPlanId: number | null = null;
  protected editFormData: Partial<UpdateSubscriptionPlanDto> = {};
  protected yearlyDiscountPercent: number = 0;
  
  // To handle the input for a "New Feature" that applies to the pool
  protected newFeatureName: string = '';

  protected readonly sections: AdminSection[] = [
    {
      title: 'Abonelik Paketleri',
      description: 'Hiyerarşik paket yapısı ile özellikleri tüm paketlere tek tıkla dağıtabilir, yeşil tik veya kırmızı X durumlarını yönetebilirsiniz.',
      highlight: 'Akıllı Matris Yönetimi',
    },
  ];

  constructor(private readonly subscriptionRepo: SubscriptionRepository) {}

  ngOnInit(): void {
    this.loadPlans();
  }

  protected loadPlans(): void {
    this.loading = true;
    this.errorMessage = null;

    this.subscriptionRepo.getAdminPlans().pipe(
      finalize(() => this.loading = false)
    ).subscribe({
      next: (plans) => {
        // 1. Sort plans by tier
        let sortedPlans = [...plans].sort((a, b) => this.getTierOrder(a.tier) - this.getTierOrder(b.tier));
        
        // 2. Identify the global pool from all fetched plans
        const pool = new Set<string>();
        sortedPlans.forEach(p => {
          p.features?.forEach(f => pool.add(typeof f === 'string' ? f : f.name));
        });
        const poolArray = Array.from(pool);

        // 3. Normalize EVERY plan immediately so cards show everything correctly
        this.plans = sortedPlans.map(plan => {
          const normalizedFeatures: PlanFeature[] = poolArray.map(name => {
            const existing = plan.features?.find(f => (typeof f === 'string' ? f : f.name) === name);
            if (existing) {
              return typeof existing === 'string' ? { name: existing, status: 'included' } : { ...existing };
            } else {
              // Smart-guess: find the LOWEST tier that has this feature as 'included'
              const sourcePlan = sortedPlans.find(sp => sp.features?.some(f => {
                const isMatch = (typeof f === 'string' ? f : f.name) === name;
                const isIncluded = typeof f === 'string' || f.status === 'included';
                return isMatch && isIncluded;
              }));
              
              const sourceTier = sourcePlan ? this.getTierOrder(sourcePlan.tier) : 99;
              const targetTier = this.getTierOrder(plan.tier);
              const status = targetTier >= sourceTier ? 'included' : 'excluded';
              return { name, status };
            }
          });

          return { ...plan, features: normalizedFeatures };
        });

        this.editingPlanId = null;
      },
      error: (err: Error) => {
        this.errorMessage = err.message || 'Paketler yüklenirken bir hata oluştu.';
      }
    });
  }

  protected editPlan(plan: SubscriptionPlan): void {
    this.successMessage = null;
    this.errorMessage = null;
    this.editingPlanId = plan.id;
    
    // 1. Get the current global pool of unique feature names
    const pool = this.globalFeaturePool;
    
    // 2. Normalize and Smart-Fill features for the plan being edited
    const currentFeatures: PlanFeature[] = [];
    
    pool.forEach(name => {
      const existing = plan.features?.find(f => (typeof f === 'string' ? f : f.name) === name);
      if (existing) {
        // If already in plan, normalize it
        currentFeatures.push(typeof existing === 'string' ? { name: existing, status: 'included' } : { ...existing });
      } else {
        // SMART GUESS: find the LOWEST tier that has this feature as 'included'
        const sourcePlan = this.plans.find(p => p.features?.some(f => {
          const isMatch = (typeof f === 'string' ? f : f.name) === name;
          const isIncluded = typeof f === 'string' || f.status === 'included';
          return isMatch && isIncluded;
        }));
        
        if (sourcePlan) {
          const sourceTier = this.getTierOrder(sourcePlan.tier);
          const targetTier = this.getTierOrder(plan.tier);
          
          // If editing a HIGHER tier than where the feature exists -> Included
          // If editing a LOWER tier -> Excluded (upsell)
          const status = targetTier >= sourceTier ? 'included' : 'excluded';
          currentFeatures.push({ name, status });
        } else {
          // If it's just in the pool but not included anywhere yet, default to excluded
          currentFeatures.push({ name, status: 'excluded' });
        }
      }
    });

    this.editFormData = {
      displayName: plan.displayName,
      description: plan.description,
      monthlyPriceTRY: plan.monthlyPriceTRY,
      yearlyPriceTRY: plan.yearlyPriceTRY,
      maxEconomists: plan.maxEconomists,
      canChangeEconomist: plan.canChangeEconomist,
      hasPrioritySupport: plan.hasPrioritySupport,
      isActive: plan.isActive,
      features: currentFeatures
    };
    
    this.calculateDiscountFromPrices();
  }

  protected cancelEdit(): void {
    this.editingPlanId = null;
    this.editFormData = {};
    this.newFeatureName = '';
  }

  /**
   * Returns all unique feature names across all plans to create the "Matrix"
   */
  protected get globalFeaturePool(): string[] {
    const names = new Set<string>();
    // Collect from all loaded plans
    this.plans.forEach(p => {
      p.features?.forEach(f => {
        names.add(typeof f === 'string' ? f : f.name);
      });
    });
    // Collect from the one being edited
    if (this.editFormData.features) {
      this.editFormData.features.forEach(f => {
        names.add(typeof f === 'string' ? f : f.name);
      });
    }
    return Array.from(names).sort();
  }

  protected getFeatureStatus(name: string): PlanFeature['status'] {
    const feat = this.editFormData.features?.find(f => (typeof f === 'string' ? f : f.name) === name);
    if (!feat) return 'hidden';
    return (typeof feat === 'string') ? 'included' : feat.status;
  }

  protected setFeatureStatus(name: string, status: PlanFeature['status']): void {
    if (!this.editFormData.features) this.editFormData.features = [];
    
    const index = this.editFormData.features.findIndex(f => (typeof f === 'string' ? f : f.name) === name);
    if (index > -1) {
      this.editFormData.features[index] = { name, status };
    } else {
      this.editFormData.features.push({ name, status });
    }
  }

  /**
   * Adds a brand new feature and applies it to ALL plans in the current session
   * This fulfills the user's requirement: "Ben birine eklediğimde diğerlerine de gelecek"
   */
  protected addNewFeature(): void {
    const name = this.newFeatureName.trim();
    if (!name) return;

    const currentPlan = this.plans.find(p => p.id === this.editingPlanId);
    if (!currentPlan) return;

    const sourceTierOrder = this.getTierOrder(currentPlan.tier);

    // 1. Update the current active FORM immediately as 'included'
    this.setFeatureStatus(name, 'included');

    // 2. Broadcast to all other plans in memory with smart defaults
    this.plans.forEach(p => {
      if (!p.features) p.features = [];
      const targetTierOrder = this.getTierOrder(p.tier);
      
      // If it doesn't already exist in that plan's memory...
      if (!p.features.some(f => (typeof f === 'string' ? f : f.name) === name)) {
        // Higher or same tier gets 'included', lower tier gets 'excluded'
        const status = targetTierOrder >= sourceTierOrder ? 'included' : 'excluded';
        p.features.push({ name, status });
      }
    });
    
    this.newFeatureName = '';
  }

  private getTierOrder(tier: SubscriptionTier): number {
    switch (tier) {
      case SubscriptionTier.Default: return 0;
      case SubscriptionTier.Premium: return 1;
      case SubscriptionTier.Ultra: return 2;
      default: return 0;
    }
  }

  /**
   * Calculates the yearly price based on monthly price and a percentage discount.
   */
  protected applyYearlyDiscount(): void {
    const monthly = this.editFormData.monthlyPriceTRY || 0;
    const discount = this.yearlyDiscountPercent || 0;
    
    if (monthly > 0) {
      const yearly = (monthly * 12) * (1 - (discount / 100));
      this.editFormData.yearlyPriceTRY = Math.round(yearly);
    }
  }

  private calculateDiscountFromPrices(): void {
    const monthly = this.editFormData.monthlyPriceTRY || 0;
    const yearly = this.editFormData.yearlyPriceTRY || 0;
    
    if (monthly > 0 && yearly > 0) {
      const fullPrice = monthly * 12;
      const discount = 100 - (yearly / fullPrice * 100);
      this.yearlyDiscountPercent = Math.round(discount);
    } else {
      this.yearlyDiscountPercent = 0;
    }
  }

  protected savePlan(planId: number): void {
    if (!this.editFormData.displayName || this.editFormData.monthlyPriceTRY === undefined) {
      this.errorMessage = 'Lütfen gerekli tüm alanları doldurun.';
      return;
    }

    // Filter features: we only send those that are NOT hidden and have a valid name
    const finalizedFeatures = (this.editFormData.features || [])
      .map(f => typeof f === 'string' ? { name: f, status: 'included' } : f)
      .filter(f => f.status !== 'hidden' && f.name && f.name.trim());

    const cleanedData = {
      ...this.editFormData,
      features: finalizedFeatures
    };

    this.loading = true;
    this.errorMessage = null;
    this.successMessage = null;

    this.subscriptionRepo.updateAdminPlan(planId, cleanedData).pipe(
      finalize(() => this.loading = false)
    ).subscribe({
      next: () => {
        this.successMessage = 'Paket ve özellik matrisi başarıyla güncellendi.';
        this.loadPlans();
      },
      error: (err: Error) => {
        this.errorMessage = err.message || 'Paket güncellenirken bir hata oluştu.';
      }
    });
  }
}

