import {
  Component, Directive, TemplateRef, contentChildren,
  input, signal, computed, inject, OnInit, output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SegmentedControlComponent, SegmentedOption } from '../segmented-control/segmented-control.component';

@Directive({ selector: '[cardView]', standalone: true })
export class CardViewDirective {
  readonly viewId = input.required<string>({ alias: 'cardView' });
  readonly templateRef = inject(TemplateRef<unknown>);
}

@Component({
  selector: 'app-holdings-card',
  standalone: true,
  imports: [CommonModule, SegmentedControlComponent],
  templateUrl: './holdings-card.component.html',
  styleUrl: './holdings-card.component.scss',
  exportAs: 'holdingsCard',
})
export class HoldingsCardComponent implements OnInit {
  readonly heading = input<string>('');
  readonly viewOptions = input<SegmentedOption[]>([]);
  readonly defaultView = input<string>('');

  readonly activeViewChange = output<string>();

  readonly viewTemplates = contentChildren(CardViewDirective);
  readonly activeView = signal<string>('');

  readonly activeTpl = computed(() => {
    const tpl = this.viewTemplates().find(t => t.viewId() === this.activeView());
    return tpl?.templateRef ?? null;
  });

  ngOnInit(): void {
    const initial = this.defaultView() || this.viewOptions()[0]?.id || 'default';
    this.activeView.set(initial);
  }

  setView(value: string): void {
    this.activeView.set(value);
    this.activeViewChange.emit(value);
  }
}
