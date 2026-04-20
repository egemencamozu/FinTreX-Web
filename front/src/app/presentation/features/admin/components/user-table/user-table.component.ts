import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';
import {
  UserManagementUser,
  SortKey,
  SortDirection,
  SortState,
} from '../../models/user-management-user.model';

export interface DeactivateUserRequestEvent {
  userId: string;
  durationKey: string;
}

@Component({
  selector: 'app-user-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-table.component.html',
  styleUrl: './user-table.component.scss',
})
export class UserTableComponent {
  users = signal<UserManagementUser[]>([]);
  isLoading = signal(false);
  busyUserId = signal<string | null>(null);

  @Input('users') set usersInput(value: UserManagementUser[]) {
    this.users.set(value || []);
  }

  @Input('isLoading') set isLoadingInput(value: boolean) {
    this.isLoading.set(value);
  }

  @Input('busyUserId') set busyUserIdInput(value: string | null) {
    this.busyUserId.set(value);
  }

  @Input() selectedUserIds: Set<string> = new Set();
  @Input() sortState: SortState = { key: 'name', direction: 'asc' };

  @Output() readonly deactivateUser = new EventEmitter<DeactivateUserRequestEvent>();
  @Output() readonly activateUser = new EventEmitter<string>();
  @Output() readonly sortChange = new EventEmitter<SortState>();
  @Output() readonly toggleSelection = new EventEmitter<string>();
  @Output() readonly toggleSelectAll = new EventEmitter<void>();

  protected activeMenuUserId = signal<string | null>(null);
  protected deactivatingUserId = signal<string | null>(null);

  protected isDurationSelectOpen = signal<boolean>(false);
  protected selectedDuration = signal<string>('ONE_WEEK');

  protected readonly durationOptions: { value: string, label: string }[] = [
    { value: 'ONE_HOUR', label: '1 Saat' },
    { value: 'ONE_DAY', label: '1 Gün' },
    { value: 'ONE_WEEK', label: '1 Hafta' },
    { value: 'ONE_MONTH', label: '1 Ay' },
    { value: 'UNLIMITED', label: 'Süresiz' }
  ];

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const isMenuClick = (event.target as HTMLElement).closest('.action-menu');
    const isTriggerClick = (event.target as HTMLElement).closest('.btn-icon-action');
    const isCustomSelectClick = (event.target as HTMLElement).closest('.custom-select-wrapper');

    if (!isCustomSelectClick) {
      this.isDurationSelectOpen.set(false);
    }

    if (!isMenuClick && !isTriggerClick) {
      this.activeMenuUserId.set(null);
      this.deactivatingUserId.set(null);
      this.isDurationSelectOpen.set(false);
    }
  }

  protected isMenuOpen(userId: string): boolean {
    return this.activeMenuUserId() === userId;
  }

  protected isBusy(userId: string): boolean {
    return this.busyUserId() === userId;
  }

  protected isSelected(userId: string): boolean {
    return this.selectedUserIds.has(userId);
  }

  protected areAllSelected(): boolean {
    const visibleUsers = this.users();
    if (visibleUsers.length === 0) return false;
    return visibleUsers.every(u => this.selectedUserIds.has(u.id));
  }

  protected getSelectedDurationLabel(): string {
    const option = this.durationOptions.find(o => o.value === this.selectedDuration());
    return option ? option.label : 'Seçiniz';
  }

  protected toggleDurationDropdown(event: Event): void {
    event.stopPropagation();
    this.isDurationSelectOpen.update(v => !v);
  }

  protected selectDurationOption(value: string, event: Event): void {
    event.stopPropagation();
    this.selectedDuration.set(value);
    this.isDurationSelectOpen.set(false);
  }

  protected startDeactivate(userId: string, event: Event): void {
    event.stopPropagation();
    this.deactivatingUserId.set(userId);
    this.selectedDuration.set('ONE_WEEK');
    this.isDurationSelectOpen.set(false);
  }

  protected cancelDeactivate(): void {
    this.deactivatingUserId.set(null);
    this.isDurationSelectOpen.set(false);
  }

  protected confirmDeactivate(userId: string): void {
    this.deactivateUser.emit({ userId, durationKey: this.selectedDuration() });
    this.deactivatingUserId.set(null);
    this.activeMenuUserId.set(null);
    this.isDurationSelectOpen.set(false);
  }

  protected requestActivate(userId: string): void {
    this.activateUser.emit(userId);
    this.activeMenuUserId.set(null);
  }

  protected toggleSort(key: SortKey): void {
    let newDirection: SortDirection = 'asc';

    if (this.sortState.key === key) {
      if (this.sortState.direction === 'asc') {
        newDirection = 'desc';
      } else if (this.sortState.direction === 'desc') {
        newDirection = null;
      } else {
        newDirection = 'asc';
      }
    }

    this.sortChange.emit({ key, direction: newDirection });
  }

  protected toggleMenu(userId: string, event: Event): void {
    event.stopPropagation();
    if (this.activeMenuUserId() === userId) {
      this.activeMenuUserId.set(null);
      this.deactivatingUserId.set(null);
    } else {
      this.activeMenuUserId.set(userId);
      this.deactivatingUserId.set(null);
    }
  }

  protected getDeactivationInfo(deactivatedUntil: string | null): { text: string; subtext: string | null; isPermanent: boolean } {
    if (!deactivatedUntil) {
      return { text: 'Spiresiz', subtext: null, isPermanent: true };
    }

    const untilDate = new Date(deactivatedUntil);
    const now = new Date();
    const diffMs = untilDate.getTime() - now.getTime();

    if (diffMs <= 0) {
      return { text: 'Siresi Doldu', subtext: 'Yenileniyor...', isPermanent: false };
    }

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let timeText = '';
    if (diffDays > 0) {
      timeText = `${diffDays} gün ${diffHours} sa.`;
    } else if (diffHours > 0) {
      timeText = `${diffHours} sa. ${diffMinutes} dk.`;
    } else {
      timeText = `${diffMinutes} dk. kaldı`;
    }

    if (timeText && !timeText.includes('kaldı')) {
      timeText += ' kaldı';
    }

    return {
      text: untilDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      subtext: timeText,
      isPermanent: false
    };
  }
}
