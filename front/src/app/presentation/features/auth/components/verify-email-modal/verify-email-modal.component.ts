import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../../core/services/auth.service';
import { OtpInputComponent } from '../../../../shared/components/otp-input/otp-input.component';

const RESEND_COOLDOWN_SECONDS = 60;

@Component({
  selector: 'app-verify-email-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, OtpInputComponent],
  templateUrl: './verify-email-modal.component.html',
  styleUrl: './verify-email-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailModalComponent implements OnInit, OnDestroy {
  @Input({ required: true }) email!: string;
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly verified = new EventEmitter<void>();

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly codeControl = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{6}$/)],
  });

  protected isSubmitting = false;
  protected isResending = false;
  protected errorMessage = '';
  protected infoMessage = '';
  protected cooldownSeconds = RESEND_COOLDOWN_SECONDS;

  private cooldownTimerId: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.startCooldown();
  }

  ngOnDestroy(): void {
    this.clearCooldownTimer();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (!this.isSubmitting) {
      this.closed.emit();
    }
  }

  protected onCodeCompleted(code: string): void {
    this.codeControl.setValue(code);
    this.onSubmit();
  }

  protected onSubmit(): void {
    if (this.codeControl.invalid || this.isSubmitting) {
      this.codeControl.markAsTouched();
      return;
    }

    this.errorMessage = '';
    this.infoMessage = '';
    this.isSubmitting = true;

    this.authService
      .verifyEmail({ email: this.email, code: this.codeControl.value })
      .pipe(
        finalize(() => {
          this.isSubmitting = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.verified.emit();
          void this.router.navigateByUrl(this.authService.getRedirectUrl());
        },
        error: (error: Error) => {
          this.errorMessage =
            error.message || 'Doğrulama başarısız oldu. Kodu kontrol edip tekrar deneyin.';
          this.codeControl.reset('');
          this.cdr.markForCheck();
        },
      });
  }

  protected onResend(): void {
    if (this.cooldownSeconds > 0 || this.isResending) {
      return;
    }

    this.errorMessage = '';
    this.infoMessage = '';
    this.isResending = true;

    this.authService
      .resendVerificationCode(this.email)
      .pipe(
        finalize(() => {
          this.isResending = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.infoMessage = 'Yeni doğrulama kodu email adresine gönderildi.';
          this.codeControl.reset('');
          this.startCooldown();
          this.cdr.markForCheck();
        },
        error: (error: Error) => {
          this.errorMessage = error.message || 'Kod yeniden gönderilemedi.';
          this.cdr.markForCheck();
        },
      });
  }

  protected onBackdropClick(event: MouseEvent): void {
    // Only dismiss when clicking the backdrop itself, not the dialog content.
    if (event.target === event.currentTarget && !this.isSubmitting) {
      this.closed.emit();
    }
  }

  private startCooldown(): void {
    this.clearCooldownTimer();
    this.cooldownSeconds = RESEND_COOLDOWN_SECONDS;

    this.cooldownTimerId = setInterval(() => {
      this.cooldownSeconds -= 1;
      if (this.cooldownSeconds <= 0) {
        this.clearCooldownTimer();
      }
      this.cdr.markForCheck();
    }, 1000);
  }

  private clearCooldownTimer(): void {
    if (this.cooldownTimerId !== null) {
      clearInterval(this.cooldownTimerId);
      this.cooldownTimerId = null;
    }
  }
}
