import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PriceAlertApiService } from '../../../../../core/services/price-alert-api.service';
import { AlertService } from '../../../../../core/services/alert.service';
import { WatchlistApiService } from '../../../../../core/services/watchlist-api.service';
import {
  AlertAssetType,
  AlertChannel,
  AlertDirection,
  AlertKind,
  AlertRepeat,
  PriceAlert,
} from '../../../../../core/models/price-alert.model';

/**
 * AlertEditorDrawer
 * ----------------------------------------------------------------------------
 * Evrensel alarm kur paneli. Sağdan kayar, overlay tıklaması kapatır.
 * Aynı bileşen Piyasa Verileri, İzleme Listesi ve Alarm Merkezi'nden çağrılır.
 */
@Component({
  selector: 'app-alert-editor-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './alert-editor-drawer.component.html',
  styleUrl: './alert-editor-drawer.component.scss',
})
export class AlertEditorDrawerComponent implements OnChanges {
  private readonly api = inject(PriceAlertApiService);
  private readonly toast = inject(AlertService);
  private readonly watchlistApi = inject(WatchlistApiService);

  // ── Inputs ──────────────────────────────────────────────────────────────
  @Input() visible = false;
  @Input() symbol = '';
  @Input() assetType: AlertAssetType = 'BIST';
  @Input() assetName = '';
  @Input() currentPrice = 0;
  @Input() currency: 'TRY' | 'USD' = 'TRY';
  /** Kullanıcının profildeki e-postası (opsiyonel). Checkbox yanında gösterilir. */
  @Input() userEmail = '';
  /** Var olan alarm düzenleme modu — verilirse form bu değerlerle doldurulur. */
  @Input() existingAlert: PriceAlert | null = null;

  // ── Outputs ─────────────────────────────────────────────────────────────
  @Output() created = new EventEmitter<PriceAlert>();
  @Output() updated = new EventEmitter<PriceAlert>();
  @Output() closed = new EventEmitter<void>();

  // ── State ───────────────────────────────────────────────────────────────
  readonly kind = signal<AlertKind>('PRICE');
  readonly direction = signal<AlertDirection>('ABOVE');
  readonly targetValue = signal<number | null>(null);
  readonly note = signal('');
  readonly repeat = signal<AlertRepeat>('ONCE');
  readonly channelInApp = signal(true);
  readonly channelEmail = signal(false);
  readonly submitting = signal(false);

  /** Alarmın bağlanacağı izleme listesi (opsiyonel). */
  readonly watchlistId = signal<string | null>(null);
  /** Sembol listede değilken "listeye de ekle" toggle'ı. */
  readonly alsoAddToWatchlist = signal(true);

  // ── Watchlist context ───────────────────────────────────────────────────
  readonly watchlists = this.watchlistApi.watchlists;

  readonly symbolWatchlistIds = computed(() =>
    this.watchlistApi.watchlistIdsContainingSymbol(this.symbol),
  );

  readonly isSymbolInSomeList = computed(
    () => this.symbolWatchlistIds().length > 0,
  );

  // ── Derived ─────────────────────────────────────────────────────────────
  readonly isEditing = computed(() => !!this.existingAlert);

  readonly canSubmit = computed(() => {
    const v = this.targetValue();
    return v !== null && !isNaN(v) && v > 0 && !this.submitting();
  });

  readonly targetHint = computed(() => {
    const v = this.targetValue();
    const kind = this.kind();
    const dir = this.direction();
    if (v === null) return '';
    if (kind === 'PRICE') {
      if (this.currentPrice <= 0) return '';
      const diffPct = ((v - this.currentPrice) / this.currentPrice) * 100;
      const sign = diffPct >= 0 ? '+' : '';
      return `Güncel fiyattan ${sign}${diffPct.toFixed(2)}% ${dir === 'ABOVE' ? 'yukarıda' : 'aşağıda'}`;
    }
    // PERCENT
    return `${dir === 'ABOVE' ? '+' : '-'}${Math.abs(v).toFixed(2)}% hareket`;
  });

  readonly currencySymbol = computed(() =>
    this.currency === 'TRY' ? '₺' : '$',
  );

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.resetFromInputs();
    }
  }

  private resetFromInputs(): void {
    const a = this.existingAlert;
    if (a) {
      this.kind.set(a.kind);
      this.direction.set(a.direction);
      this.targetValue.set(a.targetValue);
      this.note.set(a.note ?? '');
      this.repeat.set(a.repeat);
      this.channelInApp.set(a.channels.includes('IN_APP'));
      this.channelEmail.set(a.channels.includes('EMAIL'));
      this.watchlistId.set(a.watchlistId ?? null);
      this.alsoAddToWatchlist.set(false);
    } else {
      this.kind.set('PRICE');
      this.direction.set('ABOVE');
      // Varsayılan olarak anlık fiyatın %5 üstünü öner
      const suggested =
        this.currentPrice > 0
          ? Number((this.currentPrice * 1.05).toFixed(this.suggestedDecimals()))
          : null;
      this.targetValue.set(suggested);
      this.note.set('');
      this.repeat.set('ONCE');
      this.channelInApp.set(true);
      this.channelEmail.set(false);
      // Default liste: sembol bir listedeyse ilki, değilse "Ana Liste"
      const inLists = this.watchlistApi.watchlistIdsContainingSymbol(this.symbol);
      if (inLists.length > 0) {
        this.watchlistId.set(inLists[0]);
        this.alsoAddToWatchlist.set(false);
      } else {
        this.watchlistId.set(this.watchlistApi.defaultWatchlist()?.id ?? null);
        this.alsoAddToWatchlist.set(true);
      }
    }
  }

  private suggestedDecimals(): number {
    // USD ve düşük fiyatlı coinler için daha hassas yuvarlama
    if (this.currency === 'USD' || this.currentPrice < 1) return 4;
    return 2;
  }

  // ── UI actions ──────────────────────────────────────────────────────────
  setKind(k: AlertKind): void {
    if (k === this.kind()) return;
    this.kind.set(k);
    // Mod değişince hedefi mantıklı başlangıç değerine al
    if (k === 'PRICE' && this.currentPrice > 0) {
      const factor = this.direction() === 'ABOVE' ? 1.05 : 0.95;
      this.targetValue.set(
        Number((this.currentPrice * factor).toFixed(this.suggestedDecimals())),
      );
    } else if (k === 'PERCENT') {
      this.targetValue.set(5);
    }
  }

  setDirection(d: AlertDirection): void {
    this.direction.set(d);
  }

  selectWatchlistOption(id: string | null): void {
    this.watchlistId.set(id);

    if (!id || this.isEditing()) {
      this.alsoAddToWatchlist.set(false);
      return;
    }

    this.alsoAddToWatchlist.set(!this.isSymbolInWatchlist(id));
  }

  isWatchlistSelected(id: string | null): boolean {
    return this.watchlistId() === id;
  }

  isSymbolInWatchlist(id: string): boolean {
    return this.symbolWatchlistIds().includes(id);
  }

  getWatchlistItemCount(id: string): number {
    return this.watchlistApi.itemsInWatchlist(id).length;
  }

  applyChip(pct: number): void {
    if (this.kind() === 'PERCENT') {
      this.targetValue.set(Math.abs(pct));
      return;
    }
    if (this.currentPrice <= 0) return;
    const factor = this.direction() === 'ABOVE' ? 1 + pct / 100 : 1 - pct / 100;
    const next = this.currentPrice * factor;
    this.targetValue.set(Number(next.toFixed(this.suggestedDecimals())));
  }

  onBackdrop(ev: MouseEvent): void {
    if (ev.target === ev.currentTarget) this.close();
  }

  close(): void {
    if (this.submitting()) return;
    this.closed.emit();
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    const channels: AlertChannel[] = [];
    if (this.channelInApp()) channels.push('IN_APP');
    if (this.channelEmail()) channels.push('EMAIL');
    if (channels.length === 0) {
      this.toast.warning('En az bir bildirim kanalı seçmelisin.');
      return;
    }

    this.submitting.set(true);
    try {
      const payload = {
        symbol: this.symbol,
        assetType: this.assetType,
        assetName: this.assetName || undefined,
        kind: this.kind(),
        direction: this.direction(),
        targetValue: this.targetValue()!,
        baselinePrice:
          this.kind() === 'PERCENT' ? this.currentPrice : undefined,
        currency: this.currency,
        repeat: this.repeat(),
        channels,
        note: this.note().trim() || undefined,
        watchlistId: this.watchlistId() || undefined,
      };

      // Sembol seçili listede değilse ve checkbox açıksa listeye ekle
      const wlId = this.watchlistId();
      const shouldAdd =
        !this.isEditing() && this.alsoAddToWatchlist() && !!wlId;
      if (shouldAdd && wlId) {
        await this.watchlistApi.addItem(
          wlId,
          this.symbol,
          this.assetType,
          this.assetName || undefined,
        );
      }

      if (this.isEditing() && this.existingAlert) {
        const existing = this.existingAlert;
        const updated = await this.api.update(existing.id, payload);
        // Düzenlenen alarm tetiklenmiş/duraklatılmışsa resume ile ACTIVE'e alalım
        let finalAlert = updated;
        if (existing.status === 'TRIGGERED' || existing.status === 'PAUSED') {
          finalAlert = (await this.api.resume(existing.id)) ?? updated;
        }
        if (finalAlert) {
          this.toast.success(`${this.symbol} alarmı güncellendi.`);
          this.updated.emit(finalAlert);
        }
      } else {
        const created = await this.api.create(payload);
        const dir = this.direction() === 'ABOVE' ? '▲' : '▼';
        this.toast.success(
          `🔔 ${this.symbol} ${dir} ${this.formatTarget()} için alarm kuruldu.`,
        );
        this.created.emit(created);
      }
      this.closed.emit();
    } catch (err) {
      this.toast.error('Alarm kaydedilirken bir sorun oluştu.');
    } finally {
      this.submitting.set(false);
    }
  }

  formatTarget(): string {
    const v = this.targetValue();
    if (v === null) return '';
    if (this.kind() === 'PERCENT') {
      return `${v.toFixed(2)}%`;
    }
    return `${v.toLocaleString('tr-TR')} ${this.currencySymbol()}`;
  }
}
