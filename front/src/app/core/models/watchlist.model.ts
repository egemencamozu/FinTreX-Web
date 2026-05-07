// ============================================================================
// Watchlist (izleme listesi) modelleri
// ----------------------------------------------------------------------------
// Kullanıcı birden çok izleme listesi açabilir ("Ana Liste", "Favori Kripto",
// ...). Bir sembol birden çok listede bulunabilir. Her yeni kullanıcıda
// otomatik olarak silinemeyen "Ana Liste" (IsDefault=true) açılır.
// ============================================================================

import type { AlertAssetType } from './price-alert.model';

/** Varlık tipi — alarm modelindeki ile bire bir aynı. */
export type WatchlistAssetType = AlertAssetType;

export interface Watchlist {
  id: string;
  name: string;
  /** UI rozet rengi (opsiyonel). */
  color?: string;
  /** Sıralama ağırlığı — düşük = üste. */
  sortOrder: number;
  /** Silinemez "Ana Liste" için true. */
  isDefault: boolean;
  /** Hafif sayaç — backend'den `items.length` ile dolar. */
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistItem {
  id: string;
  watchlistId: string;
  symbol: string;
  assetType: WatchlistAssetType;
  assetName?: string;
  note?: string;
  addedAt: string;
}

export interface CreateWatchlistRequest {
  name: string;
  color?: string;
}

export interface RenameWatchlistRequest {
  name: string;
}

/**
 * Bir sembolü seçilen `watchlistIds` listesinin hepsinde bulundurur, diğer
 * listelerde varsa kaldırır. Popover tek-request sync için ideal.
 */
export interface ToggleSymbolRequest {
  symbol: string;
  assetType: WatchlistAssetType;
  assetName?: string;
  watchlistIds: string[];
}
