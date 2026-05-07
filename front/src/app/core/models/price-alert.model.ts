// ============================================================================
// Price Alert (fiyat alarmı) — Watchlist / Piyasa Verileri için hedef model.
// Backend devreye girene kadar `price-alert-api.service.ts` içindeki mock
// store bu tipleri localStorage üzerinde tutar; endpoint devreye alındığında
// aynı tipler HttpClient cevabı olarak kullanılır.
// ============================================================================

/** Varlık tipi — market ve portfolio tarafıyla aynı etiketler. */
export type AlertAssetType = 'BIST' | 'CRYPTO' | 'FX' | 'METAL';

/** Hedef değerin yönü. */
export type AlertDirection = 'ABOVE' | 'BELOW';

/** Hedef değer tipi. `PRICE` → mutlak fiyat; `PERCENT` → anlık fiyattan % sapma. */
export type AlertKind = 'PRICE' | 'PERCENT';

/** Alarmın yaşam döngüsü. */
export type AlertStatus = 'ACTIVE' | 'TRIGGERED' | 'PAUSED' | 'EXPIRED';

/** Tetiklendikten sonra ne olacak? */
export type AlertRepeat = 'ONCE' | 'RECURRING' | 'AUTO_DELETE';

/** Bildirim kanalları — kullanıcı profilindeki tercihlerle kesişir. */
export type AlertChannel = 'IN_APP' | 'EMAIL';

export interface PriceAlert {
  id: string;

  // Hedef subject
  symbol: string;
  assetType: AlertAssetType;
  assetName?: string;

  // Koşul
  kind: AlertKind;
  direction: AlertDirection;
  /**
   * `PRICE` için hedef fiyat (currency birimi);
   * `PERCENT` için referansa göre % sapma (ör. +5, -10).
   */
  targetValue: number;
  /** `PERCENT` modu için referans fiyat (oluşturulma anındaki fiyat). */
  baselinePrice?: number;
  currency: 'TRY' | 'USD';

  // Davranış / yaşam döngüsü
  repeat: AlertRepeat;
  status: AlertStatus;
  channels: AlertChannel[];
  note?: string;

  // İlişkili izleme listesi (opsiyonel — alarm bağımsız da yaşayabilir)
  watchlistId?: string;

  // Zaman damgaları
  createdAt: string;        // ISO
  updatedAt: string;        // ISO
  triggeredAt?: string;     // ISO
  triggeredPrice?: number;
  expiresAt?: string;       // ISO (opsiyonel süre sınırı)
}

/** Drawer'dan gönderilen "oluştur" isteği. */
export interface CreateAlertRequest {
  symbol: string;
  assetType: AlertAssetType;
  assetName?: string;
  kind: AlertKind;
  direction: AlertDirection;
  targetValue: number;
  baselinePrice?: number;
  currency: 'TRY' | 'USD';
  repeat: AlertRepeat;
  channels: AlertChannel[];
  note?: string;
  watchlistId?: string;
  alsoAddToWatchlist?: boolean;
}

/** Rozet / sayaç kartları için hafif özet. */
export interface AlertSummary {
  active: number;
  triggered: number;
  paused: number;
}
