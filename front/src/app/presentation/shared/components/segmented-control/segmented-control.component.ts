import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface SegmentedOption {
  id: string;
  label: string;
}

export type SegmentedControlVariant = 'soft' | 'outline';

@Component({
  selector: 'app-segmented-control',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './segmented-control.component.html',
  styleUrl: './segmented-control.component.scss',
})
export class SegmentedControlComponent {
  @Input() options: SegmentedOption[] = [];
  @Input() value = '';
  @Input() variant: SegmentedControlVariant = 'soft';
  @Output() valueChange = new EventEmitter<string>();

  select(id: string): void {
    if (id !== this.value) {
      this.valueChange.emit(id);
    }
  }
}
