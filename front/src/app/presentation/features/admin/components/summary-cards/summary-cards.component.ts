import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminStats } from '../../../../../core/models/admin-stats.model';

@Component({
  selector: 'app-summary-cards',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './summary-cards.component.html',
  styleUrl: './summary-cards.component.scss'
})
export class SummaryCardsComponent {
  @Input() stats: AdminStats | null = null;
  @Input() isLoading: boolean = false;
  @Input() hasError: boolean = false;
  @Input() activeStatusFilter: 'ACTIVE' | 'INACTIVE' | 'ALL' = 'ALL';

  @Output() filterByStatus = new EventEmitter<'ACTIVE' | 'INACTIVE' | 'ALL'>();
  @Output() retry = new EventEmitter<void>();

  onCardClick(filter: 'ACTIVE' | 'INACTIVE' | 'ALL'): void {
    this.filterByStatus.emit(filter);
  }

  onRetry(): void {
    this.retry.emit();
  }
}
