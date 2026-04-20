import { Component, Input, Output, EventEmitter, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-paginator',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (totalPages() > 1) {
      <div class="pgn">
        <button class="pgn__btn pgn__btn--arrow" [disabled]="page() <= 1" (click)="go(page() - 1)">
          <i class="fa-solid fa-chevron-left"></i>
        </button>

        @for (p of pageNumbers(); track p + '_' + $index) {
          @if (p === -1) {
            <span class="pgn__ellipsis">…</span>
          } @else {
            <button
              class="pgn__btn pgn__btn--num"
              [class.pgn__btn--active]="p === page()"
              (click)="go(p)"
            >{{ p }}</button>
          }
        }

        <button class="pgn__btn pgn__btn--arrow" [disabled]="page() >= totalPages()" (click)="go(page() + 1)">
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>
    }
  `,
  styleUrl: './paginator.component.scss',
})
export class PaginatorComponent {
  readonly page     = input.required<number>();
  readonly total    = input.required<number>();
  readonly pageSize = input<number>(50);

  @Output() pageChange = new EventEmitter<number>();

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  readonly rangeStart = computed(() => Math.min((this.page() - 1) * this.pageSize() + 1, this.total()));
  readonly rangeEnd   = computed(() => Math.min(this.page() * this.pageSize(), this.total()));

  readonly pageNumbers = computed<number[]>(() => {
    const total   = this.totalPages();
    const current = this.page();

    // Show all pages if there are 6 or fewer
    if (total <= 6) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    // Near the START (pages 1–4 visible)
    if (current <= 4) {
      return [1, 2, 3, 4, -1, total];
    }

    // Near the END (last 4 pages visible)
    if (current >= total - 3) {
      return [1, -1, total - 3, total - 2, total - 1, total];
    }

    // MIDDLE: 1 … cur-1 cur cur+1 … last
    return [1, -1, current - 1, current, current + 1, -1, total];
  });

  go(p: number): void {
    if (p < 1 || p > this.totalPages() || p === this.page()) return;
    this.pageChange.emit(p);
  }
}
