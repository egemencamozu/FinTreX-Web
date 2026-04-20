import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { NetworkFilterPill } from './network-filter-pill.model';

@Component({
  selector: 'app-network-filter-pills',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './network-filter-pills.html',
  styleUrl: './network-filter-pills.scss',
})
export class NetworkFilterPills {
  @Input() pills: NetworkFilterPill[] = [];
  @Input() activeId: string = '';

  @Output() onSelect = new EventEmitter<string>();

  selectPill(id: string): void {
    this.onSelect.emit(id);
  }

  isActivePill(id: string): boolean {
    return this.activeId === id;
  }
}
