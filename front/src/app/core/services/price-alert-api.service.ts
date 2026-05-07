import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AlertAssetType,
  AlertChannel,
  AlertDirection,
  AlertKind,
  AlertRepeat,
  AlertStatus,
  AlertSummary,
  CreateAlertRequest,
  PriceAlert,
} from '../models/price-alert.model';

// ============================================================================
// PriceAlertApiService (HTTP edition)
// ----------------------------------------------------------------------------
// Fiyat alarmları için backend (FinTreX.WebApi) CRUD entegrasyonu. SignalR
// tetik event'leri `AlertsSignalRService` üzerinden bu servise düşer ve
// state'teki alarm `TRIGGERED` olarak güncellenir.
//
//   GET    api/v1/pricealerts
//   POST   api/v1/pricealerts
//   PATCH  api/v1/pricealerts/:id
//   DELETE api/v1/pricealerts/:id
//   POST   api/v1/pricealerts/:id/pause
//   POST   api/v1/pricealerts/:id/resume
// ============================================================================

type BackendAssetType = 'BIST' | 'Crypto' | 'PreciousMetal';

interface BackendPriceAlertDto {
  id: number;
  symbol: string;
  assetType: BackendAssetType;
  assetName?: string | null;
  kind: AlertKind;
  direction: AlertDirection;
  targetValue: number;
  baselinePrice?: number | null;
  currency: string;
  repeat: AlertRepeat;
  channels: string[];
  note?: string | null;
  watchlistId?: number | null;
  status: AlertStatus;
  createdAtUtc: string;
  updatedAtUtc?: string | null;
  triggeredAtUtc?: string | null;
  triggeredPrice?: number | null;
  triggerCount: number;
}

@Injectable({ providedIn: 'root' })
export class PriceAlertApiService {
  private readonly http = inject(HttpClient);

  private readonly _alerts = signal<PriceAlert[]>([]);
  private readonly _loaded = signal(false);
  private _inflightReload: Promise<void> | null = null;

  readonly alerts = this._alerts.asReadonly();
  readonly isLoaded = this._loaded.asReadonly();

  readonly activeAlerts = computed(() =>
    this._alerts().filter(a => a.status === 'ACTIVE'),
  );

  readonly triggeredAlerts = computed(() =>
    this._alerts().filter(a => a.status === 'TRIGGERED'),
  );

  readonly summary = computed<AlertSummary>(() => {
    const list = this._alerts();
    return {
      active: list.filter(a => a.status === 'ACTIVE').length,
      triggered: list.filter(a => a.status === 'TRIGGERED').length,
      paused: list.filter(a => a.status === 'PAUSED').length,
    };
  });

  alertsForSymbol(symbol: string): PriceAlert[] {
    return this._alerts().filter(a => a.symbol === symbol);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  async reload(): Promise<void> {
    if (this._inflightReload) return this._inflightReload;

    const run = async (): Promise<void> => {
      try {
        const list = await firstValueFrom(
          this.http.get<BackendPriceAlertDto[]>('v1/pricealerts'),
        );
        this._alerts.set(list.map(a => this.map(a)));
        this._loaded.set(true);
      } finally {
        this._inflightReload = null;
      }
    };

    this._inflightReload = run();
    return this._inflightReload;
  }

  clear(): void {
    this._alerts.set([]);
    this._loaded.set(false);
    this._inflightReload = null;
  }

  // ── CRUD ────────────────────────────────────────────────────────────────

  async create(req: CreateAlertRequest): Promise<PriceAlert> {
    const payload = {
      symbol: req.symbol,
      assetType: this.toBackendAssetType(req.assetType),
      assetName: req.assetName ?? null,
      kind: req.kind,
      direction: req.direction,
      targetValue: req.targetValue,
      baselinePrice: req.baselinePrice ?? null,
      currency: req.currency,
      repeat: req.repeat,
      channels: req.channels,
      note: req.note ?? null,
      watchlistId: req.watchlistId ? Number(req.watchlistId) : null,
    };

    const created = await firstValueFrom(
      this.http.post<BackendPriceAlertDto>('v1/pricealerts', payload),
    );
    const mapped = this.map(created);
    this._alerts.update(list => [mapped, ...list.filter(a => a.id !== mapped.id)]);
    return mapped;
  }

  async update(id: string, patch: Partial<PriceAlert>): Promise<PriceAlert | null> {
    const body: Record<string, unknown> = {};
    if (patch.direction !== undefined) body['direction'] = patch.direction;
    if (patch.targetValue !== undefined) body['targetValue'] = patch.targetValue;
    if (patch.baselinePrice !== undefined) body['baselinePrice'] = patch.baselinePrice;
    if (patch.kind !== undefined) body['kind'] = patch.kind;
    if (patch.repeat !== undefined) body['repeat'] = patch.repeat;
    if (patch.channels !== undefined) body['channels'] = patch.channels;
    if (patch.note !== undefined) body['note'] = patch.note;
    if (patch.watchlistId !== undefined) {
      body['watchlistId'] = patch.watchlistId ? Number(patch.watchlistId) : null;
    }

    const updated = await firstValueFrom(
      this.http.patch<BackendPriceAlertDto>(`v1/pricealerts/${id}`, body),
    );
    const mapped = this.map(updated);
    this._alerts.update(list => list.map(a => (a.id === mapped.id ? mapped : a)));
    return mapped;
  }

  async delete(id: string): Promise<boolean> {
    await firstValueFrom(this.http.delete(`v1/pricealerts/${id}`));
    this._alerts.update(list => list.filter(a => a.id !== id));
    return true;
  }

  async setStatus(id: string, status: AlertStatus): Promise<PriceAlert | null> {
    if (status === 'PAUSED') return this.pause(id);
    if (status === 'ACTIVE') return this.resume(id);
    // TRIGGERED / EXPIRED durumlarını yalnızca backend belirler.
    return this._alerts().find(a => a.id === id) ?? null;
  }

  async pause(id: string): Promise<PriceAlert | null> {
    const dto = await firstValueFrom(
      this.http.post<BackendPriceAlertDto>(`v1/pricealerts/${id}/pause`, {}),
    );
    const mapped = this.map(dto);
    this._alerts.update(list => list.map(a => (a.id === mapped.id ? mapped : a)));
    return mapped;
  }

  async resume(id: string): Promise<PriceAlert | null> {
    const dto = await firstValueFrom(
      this.http.post<BackendPriceAlertDto>(`v1/pricealerts/${id}/resume`, {}),
    );
    const mapped = this.map(dto);
    this._alerts.update(list => list.map(a => (a.id === mapped.id ? mapped : a)));
    return mapped;
  }

  /**
   * SignalR'dan gelen tetik event'i alarm durumunu günceller.
   * `AUTO_DELETE` seçili alarmlar tetiklenince local state'ten de düşürülür.
   */
  applyTriggerEvent(event: {
    alertId: number | string;
    triggeredPrice: number;
    triggeredAtUtc: string;
  }): void {
    const id = String(event.alertId);
    this._alerts.update(list => {
      const existing = list.find(a => a.id === id);
      if (!existing) return list;

      if (existing.repeat === 'AUTO_DELETE') {
        return list.filter(a => a.id !== id);
      }

      return list.map(a =>
        a.id === id
          ? {
              ...a,
              status: 'TRIGGERED' as AlertStatus,
              triggeredAt: event.triggeredAtUtc,
              triggeredPrice: event.triggeredPrice,
              updatedAt: event.triggeredAtUtc,
            }
          : a,
      );
    });
  }

  /** Geriye dönük uyumluluk — gerçek tetiklemeyi backend yapar. */
  async simulateTrigger(id: string, triggeredPrice: number): Promise<PriceAlert | null> {
    const now = new Date().toISOString();
    this.applyTriggerEvent({ alertId: id, triggeredPrice, triggeredAtUtc: now });
    return this._alerts().find(a => a.id === id) ?? null;
  }

  // ── Mapping ─────────────────────────────────────────────────────────────

  private map(dto: BackendPriceAlertDto): PriceAlert {
    return {
      id: String(dto.id),
      symbol: dto.symbol,
      assetType: this.fromBackendAssetType(dto.assetType),
      assetName: dto.assetName ?? undefined,
      kind: dto.kind,
      direction: dto.direction,
      targetValue: dto.targetValue,
      baselinePrice: dto.baselinePrice ?? undefined,
      currency: dto.currency === 'USD' ? 'USD' : 'TRY',
      repeat: dto.repeat,
      channels: this.mapChannels(dto.channels),
      note: dto.note ?? undefined,
      watchlistId: dto.watchlistId ? String(dto.watchlistId) : undefined,
      status: dto.status,
      createdAt: dto.createdAtUtc,
      updatedAt: dto.updatedAtUtc ?? dto.createdAtUtc,
      triggeredAt: dto.triggeredAtUtc ?? undefined,
      triggeredPrice: dto.triggeredPrice ?? undefined,
    };
  }

  private mapChannels(list: string[]): AlertChannel[] {
    const out: AlertChannel[] = [];
    for (const v of list) {
      if (v === 'IN_APP' || v === 'EMAIL') out.push(v);
    }
    return out;
  }

  private fromBackendAssetType(t: BackendAssetType): AlertAssetType {
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

  private toBackendAssetType(t: AlertAssetType): BackendAssetType {
    switch (t) {
      case 'BIST':
        return 'BIST';
      case 'CRYPTO':
        return 'Crypto';
      case 'METAL':
        return 'PreciousMetal';
      case 'FX':
      default:
        // FX bu backend versiyonunda desteklenmiyor — BIST olarak gönderip
        // sunucu tarafında validation'a düşmesine izin veriyoruz. (Pratikte
        // UI FX alarm oluşturma akışını göstermiyor.)
        return 'BIST';
    }
  }
}
