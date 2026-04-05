import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AdminSection } from '../../models/admin-section.model';
import { finalize } from 'rxjs';
import { UserSummary } from '../../../../../core/models/user-summary.model';
import { UserManagementRepository } from '../../../../../core/interfaces/user-management.repository';
import { UserRole } from '../../../../../core/enums/user-role.enum';

interface DeactivationOption {
  label: string;
  key: string;
}

@Component({
  selector: 'app-admin-users-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-users.page.html',
  styleUrl: './admin-users.page.scss',
})
export class AdminUsersPage {
  protected readonly users: UserSummary[] = [];
  protected readonly deactivationOptions: DeactivationOption[] = [
    { label: 'Suresiz', key: 'UNLIMITED' },
    { label: '1 hafta', key: 'ONE_WEEK' },
    { label: '1 ay', key: 'ONE_MONTH' },
    { label: '1 gun', key: 'ONE_DAY' },
    { label: '1 saat', key: 'ONE_HOUR' },
  ];
  protected readonly sections: AdminSection[] = [
    {
      title: 'Kullanici hesaplari',
      description: 'Kullanicilari backend API uzerinden canli olarak listeler.',
      highlight: 'Canli veri',
    },
    {
      title: 'Hesap durumu',
      description:
        'Admin kullaniciyi secilen sure ile deactive edebilir ve sonra active yapabilir.',
      highlight: 'api/v1/user-management',
    },
  ];

  protected loading = false;
  protected actionBusyUserId: string | null = null;
  protected errorMessage: string | null = null;
  protected successMessage: string | null = null;
  protected readonly selectedDurationByUserId = new Map<string, string>();

  constructor(private readonly userManagementRepository: UserManagementRepository) {
    this.loadUsers();
  }

  protected trackByUserId(_: number, user: UserSummary): string {
    return user.id;
  }

  protected getSelectedDuration(userId: string): string {
    return this.selectedDurationByUserId.get(userId) ?? 'ONE_WEEK';
  }

  protected setSelectedDuration(userId: string, durationKey: string): void {
    this.selectedDurationByUserId.set(userId, durationKey);
  }

  protected isAdminUser(user: UserSummary): boolean {
    return user.role?.toUpperCase() === UserRole.ADMIN;
  }

  protected deactivateUser(user: UserSummary): void {
    const durationKey = this.getSelectedDuration(user.id);
    this.actionBusyUserId = user.id;
    this.errorMessage = null;
    this.successMessage = null;

    this.userManagementRepository
      .deactivateUser(user.id, durationKey)
      .pipe(
        finalize(() => {
          this.actionBusyUserId = null;
        }),
      )
      .subscribe({
        next: (response) => {
          this.successMessage = response.message;
          this.loadUsers();
        },
        error: (error: Error) => {
          this.errorMessage = error.message;
        },
      });
  }

  protected activateUser(user: UserSummary): void {
    this.actionBusyUserId = user.id;
    this.errorMessage = null;
    this.successMessage = null;

    this.userManagementRepository
      .activateUser(user.id)
      .pipe(
        finalize(() => {
          this.actionBusyUserId = null;
        }),
      )
      .subscribe({
        next: (response) => {
          this.successMessage = response.message;
          this.loadUsers();
        },
        error: (error: Error) => {
          this.errorMessage = error.message;
        },
      });
  }

  private loadUsers(): void {
    this.loading = true;
    this.errorMessage = null;

    this.userManagementRepository
      .getAllUsers()
      .pipe(
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (users) => {
          this.users.splice(0, this.users.length, ...users);
          this.selectedDurationByUserId.clear();
        },
        error: (error: Error) => {
          this.errorMessage = error.message;
        },
      });
  }
}
