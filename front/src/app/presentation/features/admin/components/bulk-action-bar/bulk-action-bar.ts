import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, computed } from '@angular/core';
import { AlertService } from '../../../../../core/services/alert.service';

@Component({
  selector: 'app-bulk-action-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bulk-action-bar.html',
  styleUrl: './bulk-action-bar.scss',
})
export class BulkActionBarComponent {
  private readonly alertService = inject(AlertService);
  
  // Computed signal to track if a modal is open
  protected readonly isModalOpen = computed(() => !!this.alertService.activeConfirmation());

  @Input() selectedCount: number = 0;
  
  @Output() readonly deactivate = new EventEmitter<void>();
  @Output() readonly activate = new EventEmitter<void>();
  @Output() readonly clearSelection = new EventEmitter<void>();
}
