import { NgFor } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SubscriptionTier } from '../../../../../core/enums/subscription-tier.enum';
import { PublicNavbar } from '../../components/public-navbar/public-navbar';
import {
  PRICING_COMPARISON_ROWS,
  PRICING_PLANS,
  type PricingComparisonRow,
  type PricingFeatureValue,
} from '../../models/pricing-catalog.model';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [NgFor, RouterLink, PublicNavbar],
  templateUrl: './pricing.html',
  styleUrl: './pricing.scss',
})
export class Pricing {
  protected readonly plans = PRICING_PLANS;
  protected readonly comparisonRows = PRICING_COMPARISON_ROWS;

  protected formatFeatureValue(value: PricingFeatureValue): string {
    if (typeof value === 'boolean') {
      return value ? 'Dahil' : 'Yok';
    }

    return value;
  }

  protected isFeatureIncluded(value: PricingFeatureValue): boolean {
    return value !== false;
  }

  protected getFeatureValue(
    row: PricingComparisonRow,
    tier: SubscriptionTier,
  ): PricingFeatureValue {
    return row.values[tier];
  }
}
