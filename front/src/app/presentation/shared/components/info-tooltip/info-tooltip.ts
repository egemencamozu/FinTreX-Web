import { Component, ElementRef, HostListener, Input, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

const TOOLTIP_WIDTH_PX = 300;
const TOOLTIP_GAP_PX = 8;
const TOOLTIP_EDGE_MARGIN_PX = 8;
const TOOLTIP_HIDE_DELAY_MS = 100;
const TOOLTIP_ESTIMATED_HEIGHT_SINGLE_PX = 160;
const TOOLTIP_ESTIMATED_HEIGHT_MULTI_PX = 220;

export type InfoTooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface InfoTooltipItem {
  text: string;
}

const TOOLTIP_ARROW_SIZE_PX = 7;

interface PanelCoords {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  transform?: string;
  arrowOffset?: string; // CSS custom property --arrow-x veya --arrow-y için
}

@Component({
  selector: 'app-info-tooltip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './info-tooltip.html',
  styleUrl: './info-tooltip.scss',
})
export class InfoTooltip {
  @Input() heading = '';
  @Input() items: InfoTooltipItem[] = [];
  @Input() learnMoreUrl = '';
  @Input() position: InfoTooltipPosition = 'bottom';

  @ViewChild('wrapper', { static: true }) private readonly wrapperRef?: ElementRef<HTMLElement>;

  protected readonly visible = signal(false);
  protected readonly effectivePosition = signal<InfoTooltipPosition>('bottom');
  protected readonly panelCoords = signal<PanelCoords>({});

  private _hideTimer: ReturnType<typeof setTimeout> | null = null;

  @HostListener('mouseenter')
  onMouseEnter(): void {
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }
    const resolved = this.resolvePosition();
    this.effectivePosition.set(resolved);
    this.panelCoords.set(this.computeCoords(resolved));
    this.visible.set(true);
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this._hideTimer = setTimeout(() => this.visible.set(false), TOOLTIP_HIDE_DELAY_MS);
  }

  private resolvePosition(): InfoTooltipPosition {
    const preferred = this.position;
    const wrapper = this.wrapperRef?.nativeElement;

    if (!wrapper || typeof window === 'undefined') return preferred;

    const rect = wrapper.getBoundingClientRect();
    const estimatedHeight = this.items.length > 1 ? TOOLTIP_ESTIMATED_HEIGHT_MULTI_PX : TOOLTIP_ESTIMATED_HEIGHT_SINGLE_PX;

    if (preferred === 'top' && rect.top < estimatedHeight + TOOLTIP_EDGE_MARGIN_PX) return 'bottom';
    if (preferred === 'bottom' && window.innerHeight - rect.bottom < estimatedHeight + TOOLTIP_EDGE_MARGIN_PX) return 'top';

    if (preferred === 'bottom' || preferred === 'top') {
      const centerX = rect.left + rect.width / 2;
      if (centerX + TOOLTIP_WIDTH_PX / 2 > window.innerWidth - TOOLTIP_EDGE_MARGIN_PX) return preferred;
    }

    return preferred;
  }

  private computeCoords(pos: InfoTooltipPosition): PanelCoords {
    const wrapper = this.wrapperRef?.nativeElement;
    if (!wrapper || typeof window === 'undefined') return {};

    const rect = wrapper.getBoundingClientRect();
    const triggerCenterX = rect.left + rect.width / 2;
    const triggerCenterY = rect.top + rect.height / 2;

    if (pos === 'bottom' || pos === 'top') {
      let left = triggerCenterX - TOOLTIP_WIDTH_PX / 2;
      left = Math.max(TOOLTIP_EDGE_MARGIN_PX, Math.min(left, window.innerWidth - TOOLTIP_WIDTH_PX - TOOLTIP_EDGE_MARGIN_PX));
      // Ok'un panel içindeki yatay konumu: trigger merkezi - panel sol kenarı
      const arrowOffset = `${triggerCenterX - left}px`;

      if (pos === 'bottom') {
        return { top: `${rect.bottom + TOOLTIP_GAP_PX + window.scrollY}px`, left: `${left}px`, arrowOffset };
      } else {
        return { bottom: `${window.innerHeight - rect.top + TOOLTIP_GAP_PX - window.scrollY}px`, left: `${left}px`, arrowOffset };
      }
    }

    if (pos === 'right') {
      const arrowOffset = `${triggerCenterY - (rect.top + window.scrollY) - TOOLTIP_ARROW_SIZE_PX}px`;
      return {
        top: `${rect.top + rect.height / 2 + window.scrollY}px`,
        left: `${rect.right + TOOLTIP_GAP_PX}px`,
        transform: 'translateY(-50%)',
        arrowOffset,
      };
    }

    const arrowOffset = `${triggerCenterY - (rect.top + window.scrollY) - TOOLTIP_ARROW_SIZE_PX}px`;
    return {
      top: `${rect.top + rect.height / 2 + window.scrollY}px`,
      right: `${window.innerWidth - rect.left + TOOLTIP_GAP_PX}px`,
      transform: 'translateY(-50%)',
      arrowOffset,
    };
  }
}
