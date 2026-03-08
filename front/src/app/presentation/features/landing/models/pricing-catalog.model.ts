import { SubscriptionTier } from '../../../../core/enums/subscription-tier.enum';

export type PricingFeatureValue = boolean | string;

export interface PricingPlan {
  tier: SubscriptionTier;
  name: string;
  tagline: string;
  priceLabel: string;
  billingNote: string;
  description: string;
  ctaLabel: string;
  ctaRoute: string;
  highlighted: boolean;
  highlights: string[];
}

export interface PricingComparisonRow {
  id: string;
  label: string;
  description: string;
  values: Record<SubscriptionTier, PricingFeatureValue>;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    tier: SubscriptionTier.DEFAULT,
    name: 'Default',
    tagline: 'Baslangic seviyesi portfoy takibi',
    priceLabel: '0 TL',
    billingNote: 'Temel giris paketi',
    description:
      'Platformu taniyip temel portfoy gorunumu, sinirli analiz ve kontrollu is akislarini denemek isteyen kullanicilar icin.',
    ctaLabel: 'Default ile Basla',
    ctaRoute: '/auth/register',
    highlighted: false,
    highlights: ['1 portfoy', 'Temel performans ozeti', 'Topluluk duyurulari'],
  },
  {
    tier: SubscriptionTier.PREMIUM,
    name: 'Premium',
    tagline: 'Aktif yatirimci icin dengeli paket',
    priceLabel: '449 TL',
    billingNote: 'Aylik faturalandirma',
    description:
      'Daha fazla portfoy, canli veri takibi ve ekonomist ile duzenli etkilesim isteyen aktif kullanicilar icin optimize edildi.',
    ctaLabel: 'Premium Sec',
    ctaRoute: '/trial',
    highlighted: true,
    highlights: ['5 portfoy', 'Gelismis dagilim analizi', 'Haftalik ekonomist mesaji'],
  },
  {
    tier: SubscriptionTier.ULTRA,
    name: 'Ultra',
    tagline: 'Danismanlik ve premium karar destegi',
    priceLabel: '1.290 TL',
    billingNote: 'Aylik faturalandirma',
    description:
      'Yuksek hacimli portfoy yonetimi, oncelikli destek ve danismanlik akislarina ihtiyac duyan kullanicilar icin.',
    ctaLabel: 'Ultra Incele',
    ctaRoute: '/trial',
    highlighted: false,
    highlights: ['Sinirsiza yakin kullanim', 'Oncelikli danismanlik', 'Yonetici tanimli ozel avantajlar'],
  },
];

export const PRICING_COMPARISON_ROWS: PricingComparisonRow[] = [
  {
    id: 'portfolio-count',
    label: 'Portfoy sayisi',
    description: 'Ayni anda yonetilebilen aktif portfoy adedi.',
    values: {
      [SubscriptionTier.DEFAULT]: '1 portfoy',
      [SubscriptionTier.PREMIUM]: '5 portfoy',
      [SubscriptionTier.ULTRA]: 'Sinirsiz',
    },
  },
  {
    id: 'asset-limit',
    label: 'Varlik ekleme limiti',
    description: 'Portfoy icerisindeki toplam aktif varlik adedi.',
    values: {
      [SubscriptionTier.DEFAULT]: '25 varlik',
      [SubscriptionTier.PREMIUM]: '250 varlik',
      [SubscriptionTier.ULTRA]: 'Sinirsiz',
    },
  },
  {
    id: 'market-data',
    label: 'Piyasa veri akis hizi',
    description: 'Fiyat ve ozet veri yenilenme sikligi.',
    values: {
      [SubscriptionTier.DEFAULT]: 'Gecikmeli veri',
      [SubscriptionTier.PREMIUM]: 'Canliya yakin veri',
      [SubscriptionTier.ULTRA]: 'Oncelikli canli veri',
    },
  },
  {
    id: 'performance-reports',
    label: 'Performans raporlari',
    description: 'Getiri ve dagilim raporlarina erisim.',
    values: {
      [SubscriptionTier.DEFAULT]: true,
      [SubscriptionTier.PREMIUM]: true,
      [SubscriptionTier.ULTRA]: true,
    },
  },
  {
    id: 'risk-analysis',
    label: 'Gelismis risk analizi',
    description: 'Risk dagilimi, yogunlasma ve senaryo bakisi.',
    values: {
      [SubscriptionTier.DEFAULT]: false,
      [SubscriptionTier.PREMIUM]: true,
      [SubscriptionTier.ULTRA]: true,
    },
  },
  {
    id: 'economist-chat',
    label: 'Ekonomist ile etkilesim',
    description: 'Paket bazli mesajlasma ve geri bildirim kapsami.',
    values: {
      [SubscriptionTier.DEFAULT]: 'Genel duyurular',
      [SubscriptionTier.PREMIUM]: 'Haftalik mesajlasma',
      [SubscriptionTier.ULTRA]: 'Oncelikli mesajlasma',
    },
  },
  {
    id: 'consultancy',
    label: 'Danismanlik gorusmeleri',
    description: 'Plan dahilindeki birebir gorusme hakki.',
    values: {
      [SubscriptionTier.DEFAULT]: false,
      [SubscriptionTier.PREMIUM]: 'Ayda 1 gorusme',
      [SubscriptionTier.ULTRA]: 'Ayda 4 gorusme',
    },
  },
  {
    id: 'admin-updates',
    label: 'Admin tanimli plan guncellemesi',
    description: 'Merkezi katalog guncellendiginde plana bagli haklarin yenilenmesi.',
    values: {
      [SubscriptionTier.DEFAULT]: true,
      [SubscriptionTier.PREMIUM]: true,
      [SubscriptionTier.ULTRA]: true,
    },
  },
];
