import { CommonModule } from '@angular/common';
import { Component, computed, signal, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { UserRole } from '../../../../../core/enums/user-role.enum';
import {
  UserManagementRepository,
  UserStatusFilter,
} from '../../../../../core/interfaces/user-management.repository';
import { UserSummary } from '../../../../../core/models/user-summary.model';
import {
  UserManagementUser,
  UserAccountStatus,
  SortState,
  SortKey,
} from '../../models/user-management-user.model';
import { AlertService } from '../../../../../core/services/alert.service';
import {
  DeactivateUserRequestEvent,
  UserTableComponent,
} from '../../components/user-table/user-table.component';
import { SummaryCardsComponent } from '../../components/summary-cards/summary-cards.component';
import { BulkActionBarComponent } from '../../components/bulk-action-bar/bulk-action-bar';
import { AdminStatsRepository } from '../../../../../core/interfaces/admin-stats.repository';
import { AdminStats } from '../../../../../core/models/admin-stats.model';

type RoleFilter = UserRole | 'ALL';

@Component({
  selector: 'app-user-management-page',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    UserTableComponent, 
    SummaryCardsComponent, 
    BulkActionBarComponent
  ],
  templateUrl: './admin-users.page.html',
  styleUrl: './admin-users.page.scss',
})
export class UserManagementPageComponent {
  protected readonly roleFilterOptions: readonly RoleFilter[] = [
    'ALL',
    UserRole.ADMIN,
    UserRole.ECONOMIST,
    UserRole.USER,
  ];
  protected readonly statusFilterOptions: readonly UserStatusFilter[] = ['ALL', 'ACTIVE', 'INACTIVE'];

  protected readonly users = signal<UserManagementUser[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly searchQuery = signal('');
  protected readonly selectedRole = signal<RoleFilter>('ALL');
  protected readonly selectedStatus = signal<UserStatusFilter>('ALL');
  protected readonly busyUserId = signal<string | null>(null);
  
  protected readonly stats = signal<AdminStats | null>(null);
  protected readonly statsLoading = signal(false);
  protected readonly statsError = signal(false);
  
  protected readonly sortState = signal<SortState>({ key: 'name', direction: 'asc' });
  protected readonly selectedUserIds = signal<Set<string>>(new Set());

  protected readonly visibleUsers = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const roleFilter = this.selectedRole();
    const statusFilter = this.selectedStatus();
    const allUsers = this.users();

    const filtered = allUsers.filter((user) => {
      // 1. Role Filter
      if (roleFilter !== 'ALL' && user.role !== roleFilter) {
        return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'ALL') {
        const isActive = user.status === 'ACTIVE';
        if (statusFilter === 'ACTIVE' && !isActive) return false;
        if (statusFilter === 'INACTIVE' && isActive) return false;
      }

      // 3. Search Query Filter
      if (query) {
        return (
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          user.role.toLowerCase().includes(query)
        );
      }

      return true;
    });

    // 4. Sorting
    const sort = this.sortState();
    if (!sort.direction) return filtered;

    const key = sort.key;
    const direction = sort.direction === 'asc' ? 1 : -1;

    return [...filtered].sort((a, b) => {
      let valA: string = '';
      let valB: string = '';

      if (key === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (key === 'role') {
        valA = a.role;
        valB = b.role;
      } else if (key === 'status') {
        valA = a.status;
        valB = b.status;
      }

      if (valA < valB) return -1 * direction;
      if (valA > valB) return 1 * direction;
      return 0;
    });
  });

  protected readonly isRoleSelectOpen = signal(false);
  protected readonly isStatusSelectOpen = signal(false);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-select-wrapper')) {
      this.isRoleSelectOpen.set(false);
      this.isStatusSelectOpen.set(false);
    }
  }

  protected getSelectedRoleLabel(): string {
    const role = this.selectedRole();
    return role === 'ALL' ? 'Tum Roller' : role;
  }

  protected getSelectedStatusLabel(): string {
    const status = this.selectedStatus();
    return status === 'ALL' ? 'Tum Durumlar' : status === 'ACTIVE' ? 'Aktif' : 'Deaktif';
  }

  protected toggleRoleSelect(event: MouseEvent): void {
    event.stopPropagation();
    this.isRoleSelectOpen.update((v) => !v);
    this.isStatusSelectOpen.set(false);
  }

  protected toggleStatusSelect(event: MouseEvent): void {
    event.stopPropagation();
    this.isStatusSelectOpen.update((v) => !v);
    this.isRoleSelectOpen.set(false);
  }

  protected selectRoleOption(role: RoleFilter, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedRole.set(role);
    this.isRoleSelectOpen.set(false);
  }

  protected selectStatusOption(status: UserStatusFilter, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedStatus.set(status);
    this.isStatusSelectOpen.set(false);
  }

  constructor(
    private readonly userManagementRepository: UserManagementRepository,
    private readonly adminStatsRepository: AdminStatsRepository,
    private readonly alertService: AlertService
  ) {
    this.loadUsers();
    this.loadStats();
  }

  protected onSearchQueryChange(nextValue: string): void {
    this.searchQuery.set(nextValue);
  }

  protected onDeactivateUser(event: DeactivateUserRequestEvent): void {
    const durationKey = event.durationKey || 'ONE_WEEK';
    this.updateUserStatus(event.userId, false, durationKey.trim().toUpperCase());
  }


  protected onActivateUser(userId: string): void {
    this.updateUserStatus(userId, true);
  }

  protected retryLoadUsers(): void {
    this.loadUsers();
  }

  protected loadStats(): void {
    this.statsLoading.set(true);
    this.statsError.set(false);

    this.adminStatsRepository.getStats()
      .pipe(finalize(() => this.statsLoading.set(false)))
      .subscribe({
        next: (stats) => this.stats.set(stats),
        error: () => this.statsError.set(true)
      });
  }

  protected onFilterByStatus(status: UserStatusFilter): void {
    this.selectedStatus.set(status);
  }

  protected onSortChange(state: SortState): void {
    this.sortState.set(state);
  }

  protected onToggleSelection(userId: string): void {
    const current = new Set(this.selectedUserIds());
    if (current.has(userId)) {
      current.delete(userId);
    } else {
      current.add(userId);
    }
    this.selectedUserIds.set(current);
  }

  protected onToggleSelectAll(): void {
    const visibleIds = this.visibleUsers().map(u => u.id);
    const current = this.selectedUserIds();
    
    // If all visible users are already selected, clear selection
    // Otherwise, select all visible users
    const allSelected = visibleIds.every(id => current.has(id));
    
    if (allSelected) {
      const next = new Set(current);
      visibleIds.forEach(id => next.delete(id));
      this.selectedUserIds.set(next);
    } else {
      const next = new Set(current);
      visibleIds.forEach(id => next.add(id));
      this.selectedUserIds.set(next);
    }
  }

  protected onClearSelection(): void {
    this.selectedUserIds.set(new Set());
  }

  protected onBulkActivate(): void {
    const userIds = Array.from(this.selectedUserIds());
    if (userIds.length === 0) return;

    this.alertService.confirm(`${userIds.length} kullanıcıyı aktif etmek istediğinize emin misiniz?`)
      .then(confirmed => {
        if (!confirmed) return;
        
        this.isLoading.set(true);
        this.userManagementRepository.bulkActivate(userIds)
          .pipe(finalize(() => this.isLoading.set(false)))
          .subscribe({
            next: (res: { message: string }) => {
              this.alertService.success(res.message || 'Kullanıcılar başarıyla aktif edildi.');
              this.onClearSelection();
              this.loadUsers();
              this.loadStats();
            },
            error: (err: any) => this.alertService.error(err.message)
          });
      });
  }

  protected onBulkDeactivate(): void {
    const userIds = Array.from(this.selectedUserIds());
    if (userIds.length === 0) return;

    this.alertService.confirm(`${userIds.length} kullanıcıyı devre dışı bırakmak istediğinize emin misiniz? (Varsayılan süre: 1 Hafta)`)
      .then(confirmed => {
        if (!confirmed) return;

        this.isLoading.set(true);
        this.userManagementRepository.bulkDeactivate(userIds, 'ONE_WEEK')
          .pipe(finalize(() => this.isLoading.set(false)))
          .subscribe({
            next: (res: { message: string }) => {
              this.alertService.success(res.message || 'Kullanıcılar başarıyla devre dışı bırakıldı.');
              this.onClearSelection();
              this.loadUsers();
              this.loadStats();
            },
            error: (err: any) => this.alertService.error(err.message)
          });
      });
  }

  protected loadUsers(): void {
    this.isLoading.set(true);

    // Fetch all users once; filtering will happen on the client-side
    this.userManagementRepository
      .getUsers({
        role: 'ALL',
        status: 'ALL',
      })
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
        }),
      )
      .subscribe({
        next: (users) => {
          const mapped = users.map((user) => this.mapUser(user));
          this.users.set(mapped);
        },
        error: (error: Error) => {
          this.alertService.error(`Kullanicilar yuklenirken bir hata olustu: ${error.message}`);
        },
      });
  }

  private updateUserStatus(userId: string, isActive: boolean, durationKey = 'ONE_WEEK'): void {
    this.busyUserId.set(userId);

    this.userManagementRepository
      .updateUserStatus(userId, isActive, durationKey)
      .pipe(
        finalize(() => {
          this.busyUserId.set(null);
        }),
      )
      .subscribe({
        next: (response) => {
          this.alertService.success(response.message);
          this.loadUsers();
          this.loadStats();
        },
        error: (error: Error) => {
          this.alertService.error(`Hesap durumu guncellenirken hata: ${error.message}`);
        },
      });
  }


  private mapUser(user: UserSummary): UserManagementUser {
    const name = this.buildDisplayName(user);
    const role = this.normalizeRole(user.role);
    const status: UserAccountStatus = user.isActive ? 'ACTIVE' : 'INACTIVE';

    return {
      id: user.id,
      avatarUrl: user.avatarUrl ?? null,
      initials: this.extractInitials(user.firstName, user.lastName, user.userName),
      name,
      email: user.email,
      role,
      status,
      deactivatedUntil: user.deactivatedUntil ?? null,
    };
  }

  private buildDisplayName(user: UserSummary): string {
    const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    if (fullName) {
      return fullName;
    }

    return user.userName || 'Bilinmeyen Kullanici';
  }

  private extractInitials(firstName?: string, lastName?: string, userName?: string): string {
    const first = (firstName ?? '').trim().charAt(0);
    const last = (lastName ?? '').trim().charAt(0);
    const combined = `${first}${last}`.toUpperCase();

    if (combined) {
      return combined;
    }

    const userNameInitial = (userName ?? '').trim().substring(0, 2).toUpperCase();
    return userNameInitial || '??';
  }

  private normalizeRole(rawRole: string): UserRole {
    const normalized = rawRole?.trim().toUpperCase();
    if (normalized === UserRole.ADMIN) return UserRole.ADMIN;
    if (normalized === UserRole.ECONOMIST) return UserRole.ECONOMIST;
    if (normalized === UserRole.USER) return UserRole.USER;

    console.warn(`Unsupported user role reached mapper: '${rawRole}'. Defaulting to USER.`);
    return UserRole.USER;
  }

  private parseRoleFilter(rawRole: string): RoleFilter {
    if (rawRole === 'ALL') return 'ALL';
    const normalized = rawRole?.toUpperCase();
    if (normalized === UserRole.ADMIN) return UserRole.ADMIN;
    if (normalized === UserRole.ECONOMIST) return UserRole.ECONOMIST;
    if (normalized === UserRole.USER) return UserRole.USER;

    throw new Error(`Unsupported role filter '${rawRole}'.`);
  }

  private parseStatusFilter(rawStatus: string): UserStatusFilter {
    const normalized = rawStatus?.toUpperCase();
    if (normalized === 'ALL' || normalized === 'ACTIVE' || normalized === 'INACTIVE') {
      return normalized as UserStatusFilter;
    }

    throw new Error(`Unsupported status filter '${rawStatus}'.`);
  }
}

export { UserManagementPageComponent as AdminUsersPage };
