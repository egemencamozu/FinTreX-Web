import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  InfoTooltip,
  InfoTooltipItem,
  InfoTooltipPosition,
} from '../info-tooltip/info-tooltip';

type KpiTrend = 'up' | 'down' | 'neutral';

export interface KpiTooltipConfig {
  heading?: string;
  items?: InfoTooltipItem[];
  learnMoreUrl?: string;
  position?: InfoTooltipPosition;
}

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule, InfoTooltip],
  templateUrl: './kpi-card.component.html',
  styleUrl: './kpi-card.component.scss',
})
export class KpiCardComponent {
  @Input() label = '';
  @Input() title = '';
  @Input() value = '';
  @Input() secondaryValue = '';
  @Input() changeValue: number | null = null;
  @Input() changeText = '';
  @Input() subtitle = '';
  @Input() hasIcon = false;
  @Input() loading = false;
  @Input() clickable = false;
  @Input() tooltip: KpiTooltipConfig | null = null;

  @Output() cardClick = new EventEmitter<void>();

  get trend(): KpiTrend {
    if (this.changeValue === null || Number.isNaN(this.changeValue)) return 'neutral';
    if (this.changeValue > 0) return 'up';
    if (this.changeValue < 0) return 'down';
    return 'neutral';
  }

  get changeLabel(): string {
    if (this.changeValue === null) return '';
    const abs = Math.abs(this.changeValue).toFixed(2);
    return `${abs}%`;
  }

  onCardClick(): void {
    if (this.clickable) {
      this.cardClick.emit();
    }
  }
}
