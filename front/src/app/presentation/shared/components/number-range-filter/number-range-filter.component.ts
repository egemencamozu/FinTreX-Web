import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
} from '@angular/core';

export interface NumberRangeFilterPreset {
  id: string;
  label: string;
  min: number | null;
  max: number | null;
}

export interface NumberRangeFilterValue {
  presetId: string;
  min: number | null;
  max: number | null;
}

const EMPTY_FILTER_VALUE: NumberRangeFilterValue = {
  presetId: 'any',
  min: null,
  max: null,
};

@Component({
  selector: 'app-number-range-filter',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './number-range-filter.component.html',
  styleUrl: './number-range-filter.component.scss',
})
export class NumberRangeFilterComponent implements OnChanges {
  @Input({ required: true }) label = '';
  @Input() presets: readonly NumberRangeFilterPreset[] = [];
  @Input() value: NumberRangeFilterValue = EMPTY_FILTER_VALUE;
  @Input() minPlaceholder = 'Min';
  @Input() maxPlaceholder = 'Max';

  @Output() apply = new EventEmitter<NumberRangeFilterValue>();

  readonly isOpen = signal(false);
  readonly draftPresetId = signal('any');
  readonly draftMin = signal<number | null>(null);
  readonly draftMax = signal<number | null>(null);

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      this.syncDraftFromValue(this.value ?? EMPTY_FILTER_VALUE);
    }
  }

  togglePanel(): void {
    this.isOpen.update(open => !open);
    if (this.isOpen()) {
      this.syncDraftFromValue(this.value ?? EMPTY_FILTER_VALUE);
    }
  }

  selectPreset(preset: NumberRangeFilterPreset): void {
    this.draftPresetId.set(preset.id);
    this.draftMin.set(preset.min);
    this.draftMax.set(preset.max);
  }

  onMinInput(raw: string): void {
    this.draftMin.set(this.parseNumberInput(raw));
    this.draftPresetId.set(this.resolvePresetId(this.draftMin(), this.draftMax()));
  }

  onMaxInput(raw: string): void {
    this.draftMax.set(this.parseNumberInput(raw));
    this.draftPresetId.set(this.resolvePresetId(this.draftMin(), this.draftMax()));
  }

  onReset(): void {
    const nextValue = { ...EMPTY_FILTER_VALUE };
    this.syncDraftFromValue(nextValue);
    this.apply.emit(nextValue);
  }

  onApply(): void {
    let min = this.draftMin();
    let max = this.draftMax();

    if (min !== null && max !== null && min > max) {
      [min, max] = [max, min];
    }

    const nextValue: NumberRangeFilterValue = {
      presetId: this.resolvePresetId(min, max),
      min,
      max,
    };

    this.apply.emit(nextValue);
    this.isOpen.set(false);
  }

  isPresetSelected(presetId: string): boolean {
    return this.draftPresetId() === presetId;
  }

  isActive(): boolean {
    const current = this.value ?? EMPTY_FILTER_VALUE;
    return current.min !== null || current.max !== null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.isOpen()) return;
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.isOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
    }
  }

  private syncDraftFromValue(value: NumberRangeFilterValue): void {
    const nextMin = value.min ?? null;
    const nextMax = value.max ?? null;
    this.draftMin.set(nextMin);
    this.draftMax.set(nextMax);
    this.draftPresetId.set(this.resolvePresetId(nextMin, nextMax, value.presetId));
  }

  private parseNumberInput(raw: string): number | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return null;
    if (parsed < 0) return 0;
    return parsed;
  }

  private resolvePresetId(
    min: number | null,
    max: number | null,
    fallback: string = 'custom',
  ): string {
    const matchedPreset = this.presets.find(p => p.min === min && p.max === max);
    if (matchedPreset) {
      return matchedPreset.id;
    }
    if (min === null && max === null) {
      return 'any';
    }
    return fallback;
  }
}
