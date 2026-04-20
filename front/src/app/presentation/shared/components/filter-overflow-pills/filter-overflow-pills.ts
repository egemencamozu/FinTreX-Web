import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, Output, inject, signal } from '@angular/core';

export interface FilterOverflowPill {
  id: string;
  label: string;
  icon?: string;
  isImage?: boolean;
}

@Component({
  selector: 'app-filter-overflow-pills',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './filter-overflow-pills.html',
  styleUrl: './filter-overflow-pills.scss',
})
export class FilterOverflowPillsComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  @Input() pills: readonly FilterOverflowPill[] = [];
  @Input() activeId = '';
  @Input() visibleLimit = 5;
  @Input() moreLabel = 'More';
  @Input() searchPlaceholder = 'Search';
  @Input() showMenuIcons = true;

  @Output() selectionChange = new EventEmitter<string>();

  readonly isOpen = signal(false);
  readonly query = signal('');

  visiblePills(): readonly FilterOverflowPill[] {
    return this.pills.slice(0, Math.max(0, this.visibleLimit));
  }

  hiddenPills(): readonly FilterOverflowPill[] {
    return this.pills.slice(Math.max(0, this.visibleLimit));
  }

  filteredMenuPills(): readonly FilterOverflowPill[] {
    const query = this.query().trim().toLocaleLowerCase('tr-TR');
    if (!query) return this.pills;
    return this.pills.filter(pill => pill.label.toLocaleLowerCase('tr-TR').includes(query));
  }

  hasHiddenActive(): boolean {
    return this.hiddenPills().some(pill => pill.id === this.activeId);
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  selectPill(id: string): void {
    this.selectionChange.emit(id);
    this.close();
  }

  toggleMenu(): void {
    this.isOpen.update(isOpen => !isOpen);
  }

  setQuery(value: string): void {
    this.query.set(value);
  }

  close(): void {
    this.isOpen.set(false);
    this.query.set('');
  }

  isActive(id: string): boolean {
    return this.activeId === id;
  }
}
