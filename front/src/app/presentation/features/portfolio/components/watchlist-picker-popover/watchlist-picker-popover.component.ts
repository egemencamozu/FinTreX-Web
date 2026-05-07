import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewEncapsulation,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WatchlistApiService } from '../../../../../core/services/watchlist-api.service';
import { AlertService } from '../../../../../core/services/alert.service';
import type { WatchlistAssetType } from '../../../../../core/models/watchlist.model';

/**
 * WatchlistPicker modalı
 * ----------------------------------------------------------------------------
 * Bir sembolü birden çok izleme listesine ekleyip çıkarmak için ortalanmış
 * modal. Değişiklikler "Kaydet" ile uygulanır, "Vazgeç" iptal eder.
 * Kök element `<body>`'ye portal edilir ki transform'lu ataların altında
 * hiza bozulmasın.
 */
@Component({
  selector: 'app-watchlist-picker-popover',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './watchlist-picker-popover.component.html',
  styleUrl: './watchlist-picker-popover.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class WatchlistPickerPopoverComponent implements OnChanges, OnDestroy {
  private readonly api = inject(WatchlistApiService);
  private readonly toast = inject(AlertService);
  private readonly hostRef = inject(ElementRef<HTMLElement>);

  // ── Inputs ──────────────────────────────────────────────────────────────
  @Input() visible = false;
  @Input() symbol = '';
  @Input() assetType: WatchlistAssetType = 'BIST';
  @Input() assetName = '';

  // ── Outputs ─────────────────────────────────────────────────────────────
  @Output() closed = new EventEmitter<void>();

  // ── State ───────────────────────────────────────────────────────────────
  readonly watchlists = this.api.watchlists;
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly initialIds = signal<Set<string>>(new Set());
  readonly showNewInput = signal(false);
  readonly newListName = signal('');
  readonly creating = signal(false);
  readonly saving = signal(false);

  /** Portal edilecek kök div. */
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  constructor() {
    // Popover her renderlandığında kök node'u <body>'ye taşı — pozisyon ve
    // z-index sorunlarının önüne geç.
    effect(() => {
      const el = this.panel()?.nativeElement;
      if (el && el.parentElement !== document.body) {
        document.body.appendChild(el);
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      const current = new Set(this.api.watchlistIdsContainingSymbol(this.symbol));
      this.initialIds.set(new Set(current));
      this.selectedIds.set(current);
      this.showNewInput.set(false);
      this.newListName.set('');
    }
  }

  ngOnDestroy(): void {
    this.panel()?.nativeElement?.remove();
  }

  // ── Selection ───────────────────────────────────────────────────────────
  isChecked(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleList(id: string): void {
    const next = new Set(this.selectedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedIds.set(next);
  }

  // ── New list ───────────────────────────────────────────────────────────
  openNewListInput(): void {
    this.showNewInput.set(true);
    this.newListName.set('');
  }

  cancelNewList(): void {
    this.showNewInput.set(false);
    this.newListName.set('');
  }

  async createAndToggle(): Promise<void> {
    const name = this.newListName().trim();
    if (!name) return;
    this.creating.set(true);
    try {
      const wl = await this.api.createWatchlist({ name });
      const next = new Set(this.selectedIds());
      next.add(wl.id);
      this.selectedIds.set(next);
      this.showNewInput.set(false);
      this.newListName.set('');
    } catch {
      this.toast.error('Liste oluşturulurken sorun oluştu.');
    } finally {
      this.creating.set(false);
    }
  }

  // ── Save / Cancel ──────────────────────────────────────────────────────
  async saveAndClose(): Promise<void> {
    const selected = [...this.selectedIds()];
    this.saving.set(true);
    try {
      await this.api.toggleSymbolInWatchlists({
        symbol: this.symbol,
        assetType: this.assetType,
        assetName: this.assetName || undefined,
        watchlistIds: selected,
      });

      const added = selected.length - [...this.initialIds()].filter((id) => this.selectedIds().has(id)).length;
      const removed = [...this.initialIds()].filter((id) => !this.selectedIds().has(id)).length;
      if (added > 0 || removed > 0) {
        this.toast.success(`${this.symbol} izleme listeleri güncellendi.`);
      }
      this.close();
    } catch {
      this.toast.error('Kaydedilemedi, lütfen tekrar deneyin.');
    } finally {
      this.saving.set(false);
    }
  }

  onBackdrop(): void {
    this.close();
  }

  close(): void {
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible) this.close();
  }
}
