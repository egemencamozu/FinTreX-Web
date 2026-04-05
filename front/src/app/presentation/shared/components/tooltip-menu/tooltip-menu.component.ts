import {
  Component,
  Input,
  TemplateRef,
  ElementRef,
  HostListener,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export type TooltipPosition = 'right' | 'bottom' | 'left' | 'top';

@Component({
  selector: 'app-tooltip-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tooltip-menu.component.html',
  styleUrl: './tooltip-menu.component.scss',
})
export class TooltipMenuComponent {
  @Input() label = '';
  @Input() position: TooltipPosition = 'right';
  @Input() contentTpl?: TemplateRef<unknown>;
  @Input() disabled = false;

  private readonly elRef = inject(ElementRef);

  protected readonly visible = signal(false);

  @HostListener('mouseenter')
  onMouseEnter(): void {
    if (!this.disabled) {
      this.visible.set(true);
    }
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.visible.set(false);
  }
}
