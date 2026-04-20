import { CommonModule } from '@angular/common';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface DeactivateUserDialogData {
  userName: string;
}

interface DeactivationDurationOption {
  key: string;
  label: string;
}

@Component({
  selector: 'app-deactivate-user-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './deactivate-user-dialog.component.html',
  styleUrl: './deactivate-user-dialog.component.scss',
})
export class DeactivateUserDialogComponent {
  protected readonly data = inject<DeactivateUserDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<string | undefined>>(DialogRef);

  protected readonly durationOptions: DeactivationDurationOption[] = [
    { key: 'UNLIMITED', label: 'Suresiz' },
    { key: 'ONE_WEEK', label: '1 Hafta' },
    { key: 'ONE_MONTH', label: '1 Ay' },
    { key: 'ONE_DAY', label: '1 Gun' },
  ];

  protected readonly selectedDuration = signal('ONE_WEEK');

  protected onDurationChange(nextDuration: string): void {
    this.selectedDuration.set(nextDuration);
  }

  protected confirm(): void {
    this.dialogRef.close(this.selectedDuration());
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}

