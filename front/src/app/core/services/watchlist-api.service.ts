import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CreateWatchlistRequest,
  RenameWatchlistRequest,
  ToggleSymbolRequest,
  Watchlist,
  WatchlistAssetType,
  WatchlistItem,
} from '../models/watchlist.model';

// ============================================================================
// WatchlistApiService (HTTP edition)
// ----------------------------------------------------------------------------
// Tüm CRUD operasyonlarını backend'e (FinTreX.WebApi) iletir. Yanıtları
// reactive signal state'e yazar; bileşenler `watchlists`/`symbolsInAnyWatchlist`
// gibi computed signal'ları bozmadan kullanmaya devam edebilir.
//
// Backend endpoint'leri:
//   GET    api/v1/watchlists
//   POST   api/v1/watchlists                   { name, color? }
//   PATCH  api/v1/watchlists/:id               { name?, color?, sortOrder? }
//   DELETE api/v1/watchlists/:id
//   GET    api/v1/watchlists/:id/items
//   POST   api/v1/watchlists/:id/items         { symbol, assetType, assetName? }
//   DELETE api/v1/watchlists/:id/items/:itemId
//   POST   api/v1/watchlists/toggle-symbol     ToggleSymbolRequest
//   GET    api/v1/watchlists/favorites         string[]
// ============================================================================

interface BackendWatchlistDto {
  id: number;
  name: string;
  color?: string | null;
  sortOrder: number;
  isDefault: boolean;
  itemCount: number;
  createdAtUtc: string;
  updatedAtUtc?: string | null;
}

interface BackendWatchlistItemDto {
  id: number;
  watchlistId: number;
  symbol: string;
  assetType: BackendAssetType;
  assetName?: string | null;
  note?: string | null;
  addedAtUtc: string;
}

type BackendAssetType = 'BIST' | 'Crypto' | 'PreciousMetal';

@Injectable({ providedIn: 'root' })
export class WatchlistApiService {
  private readonly http = inject(HttpClient);

  private readonly _lists = signal<Watchlist[]>([]);
  private readonly _items = signal<WatchlistItem[]>([]);
  private readonly _loaded = signal(false);
  private _inflightReload: Promise<void> | null = null;

  /** Tüm listeler (sıralı). */
  readonly watchlists = computed(() =>
    [...this._lists()].sort((a, b) => a.sortOrder - b.sortOrder),
  );

  /** Varsayılan "Ana Liste". */
  readonly defaultWatchlist = computed(
    () => this._lists().find(w => w.isDefault) ?? this._lists()[0] ?? null,
  );

  /** En az bir listede bulunan tüm semboller — yıldız "dolu" hesabı için. */
  readonly symbolsInAnyWatchlist = computed<Set<string>>(() => {
    const s = new Set<string>();
    for (const it of this._items()) s.add(it.symbol);
    return s;
  });

  readonly isLoaded = this._loaded.asReadonly();

  // ── Queries ─────────────────────────────────────────────────────────────

  itemsInWatchlist(watchlistId: string): WatchlistItem[] {
    return this._items().filter(i => i.watchlistId === watchlistId);
  }

  watchlistIdsContainingSymbol(symbol: string): string[] {
    return this._items()
      .filter(i => i.symbol === symbol)
      .map(i => i.watchlistId);
  }

  isSymbolInAnyWatchlist(symbol: string): boolean {
    return this._items().some(i => i.symbol === symbol);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  /**
   * Listeleri ve item'ları backend'den yükler. Aynı anda birden çok çağrı
   * gelirse tek HTTP turu çalıştırır; tekrar çağrıldığında yeniden çeker.
   */
  async reload(): Promise<void> {
    if (this._inflightReload) return this._inflightReload;

    const run = async (): Promise<void> => {
      try {
        const lists = await firstValueFrom(
          this.http.get<BackendWatchlistDto[]>('v1/watchlists'),
        );
        const mappedLists = lists.map(l => this.mapList(l));
        this._lists.set(mappedLists);

        const itemsNested = await Promise.all(
          mappedLists.map(l =>
            firstValueFrom(
              this.http.get<BackendWatchlistItemDto[]>(`v1/watchlists/${l.id}/items`),
            ).catch(() => [] as BackendWatchlistItemDto[]),
          ),
        );
        const flatItems = itemsNested.flat().map(i => this.mapItem(i));
        this._items.set(flatItems);
        this._loaded.set(true);
      } finally {
        this._inflightReload = null;
      }
    };

    this._inflightReload = run();
    return this._inflightReload;
  }

  /** Dışarıdan çağrılabilen temizleme (logout sonrası). */
  clear(): void {
    this._lists.set([]);
    this._items.set([]);
    this._loaded.set(false);
    this._inflightReload = null;
  }

  // ── Watchlist CRUD ──────────────────────────────────────────────────────

  async createWatchlist(req: CreateWatchlistRequest): Promise<Watchlist> {
    const created = await firstValueFrom(
      this.http.post<BackendWatchlistDto>('v1/watchlists', {
        name: req.name.trim(),
        color: req.color ?? null,
      }),
    );
    const mapped = this.mapList(created);
    this._lists.update(list => [...list, mapped]);
    return mapped;
  }

  async renameWatchlist(id: string, req: RenameWatchlistRequest): Promise<Watchlist | null> {
    const updated = await firstValueFrom(
      this.http.patch<BackendWatchlistDto>(`v1/watchlists/${id}`, {
        name: req.name.trim(),
      }),
    );
    const mapped = this.mapList(updated);
    this._lists.update(list => list.map(w => (w.id === mapped.id ? mapped : w)));
    return mapped;
  }

  async deleteWatchlist(id: string): Promise<{ ok: boolean; reason?: string }> {
    try {
      await firstValueFrom(this.http.delete(`v1/watchlists/${id}`));
      this._lists.update(list => list.filter(w => w.id !== id));
      this._items.update(list => list.filter(i => i.watchlistId !== id));
      return { ok: true };
    } catch (err: unknown) {
      const reason =
        err instanceof Error && /default/i.test(err.message)
          ? 'default_list'
          : 'server_error';
      return { ok: false, reason };
    }
  }

  // ── Watchlist item CRUD ─────────────────────────────────────────────────

  async addItem(
    watchlistId: string,
    symbol: string,
    assetType: WatchlistAssetType,
    assetName?: string,
  ): Promise<WatchlistItem | null> {
    const beAssetType = this.toBackendAssetType(assetType);
    if (!beAssetType) return null;

    const created = await firstValueFrom(
      this.http.post<BackendWatchlistItemDto>(`v1/watchlists/${watchlistId}/items`, {
        symbol,
        assetType: beAssetType,
        assetName: assetName ?? null,
      }),
    );
    const mapped = this.mapItem(created);
    this._items.update(list => {
      if (list.some(i => i.id === mapped.id)) return list;
      return [...list, mapped];
    });
    this.bumpItemCount(watchlistId, +1);
    return mapped;
  }

  async removeItem(watchlistId: string, symbol: string): Promise<boolean> {
    const target = this._items().find(
      i => i.watchlistId === watchlistId && i.symbol === symbol,
    );
    if (!target) return false;

    await firstValueFrom(
      this.http.delete(`v1/watchlists/${watchlistId}/items/${target.id}`),
    );
    this._items.update(list => list.filter(i => i.id !== target.id));
    this.bumpItemCount(watchlistId, -1);
    return true;
  }

  /**
   * Tek request ile sembol-liste ilişkisini senkronlar. Backend hangi listelerde
   * kalması gerektiğini baz alarak ekler/siler; biz de state'i buna göre tazeleriz.
   */
  async toggleSymbolInWatchlists(req: ToggleSymbolRequest): Promise<WatchlistItem[]> {
    const beAssetType = this.toBackendAssetType(req.assetType);
    if (!beAssetType) return this._items().filter(i => i.symbol === req.symbol);

    const payload = {
      symbol: req.symbol,
      assetType: beAssetType,
      assetName: req.assetName ?? null,
      watchlistIds: req.watchlistIds.map(id => Number(id)).filter(n => Number.isFinite(n)),
    };

    await firstValueFrom(
      this.http.post('v1/watchlists/toggle-symbol', payload),
    );

    // Backend tarafında hem ekleme hem silme olabildiği için en güvenli yol
    // listeleri ve ilgili item'ları yeniden çekmek. Her liste için item endpoint'ini
    // çağırıp state'i tazeliyoruz.
    const lists = this._lists();
    const itemsNested = await Promise.all(
      lists.map(l =>
        firstValueFrom(
          this.http.get<BackendWatchlistItemDto[]>(`v1/watchlists/${l.id}/items`),
        ).catch(() => [] as BackendWatchlistItemDto[]),
      ),
    );
    const flat = itemsNested.flat().map(i => this.mapItem(i));
    this._items.set(flat);

    // Her listenin itemCount'unu backend kayıtlarıyla senkronla.
    this._lists.update(list =>
      list.map(w => ({
        ...w,
        itemCount: flat.filter(i => i.watchlistId === w.id).length,
      })),
    );

    return flat.filter(i => i.symbol === req.symbol);
  }

  // ── Mapping helpers ─────────────────────────────────────────────────────

  private mapList(dto: BackendWatchlistDto): Watchlist {
    return {
      id: String(dto.id),
      name: dto.name,
      color: dto.color ?? undefined,
      sortOrder: dto.sortOrder,
      isDefault: dto.isDefault,
      itemCount: dto.itemCount,
      createdAt: dto.createdAtUtc,
      updatedAt: dto.updatedAtUtc ?? dto.createdAtUtc,
    };
  }

  private mapItem(dto: BackendWatchlistItemDto): WatchlistItem {
    return {
      id: String(dto.id),
      watchlistId: String(dto.watchlistId),
      symbol: dto.symbol,
      assetType: this.fromBackendAssetType(dto.assetType),
      assetName: dto.assetName ?? undefined,
      note: dto.note ?? undefined,
      addedAt: dto.addedAtUtc,
    };
  }

  private fromBackendAssetType(t: BackendAssetType): WatchlistAssetType {
    switch (t) {
      case 'BIST':
        return 'BIST';
      case 'Crypto':
        return 'CRYPTO';
      case 'PreciousMetal':
        return 'METAL';
      default:
        return 'BIST';
    }
  }

  private toBackendAssetType(t: WatchlistAssetType): BackendAssetType | null {
    switch (t) {
      case 'BIST':
        return 'BIST';
      case 'CRYPTO':
        return 'Crypto';
      case 'METAL':
        return 'PreciousMetal';
      case 'FX':
        // Backend şu an FX tipini desteklemiyor.
        return null;
      default:
        return null;
    }
  }

  private bumpItemCount(watchlistId: string, delta: number): void {
    this._lists.update(list =>
      list.map(w =>
        w.id === watchlistId
          ? {
              ...w,
              itemCount: Math.max(0, w.itemCount + delta),
              updatedAt: new Date().toISOString(),
            }
          : w,
      ),
    );
  }
}
