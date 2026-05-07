import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../../core/services/auth.service';

type Step = 'password' | 'code' | 'confirm';

@Component({
  selector: 'app-account-actions',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './account-actions.html',
  styleUrl: './account-actions.scss',
})
export class AccountActions {
  protected step: Step = 'password';
  protected isSubmitting = false;
  protected errorMessage = '';
  protected successMessage = '';

  protected readonly passwordForm: FormGroup;
  protected readonly codeForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    this.passwordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
    });

    this.codeForm = this.fb.group({
      verificationCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
  }

  protected onPasswordSubmit(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.errorMessage = '';
    this.isSubmitting = true;
    const { password } = this.passwordForm.getRawValue();

    this.authService
      .requestAccountDeletionCode(password)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          this.step = 'code';
        },
        error: (err: Error) => {
          this.errorMessage = err.message || 'Bir hata oluştu. Lütfen tekrar deneyin.';
        },
      });
  }

  protected onCodeSubmit(): void {
    if (this.codeForm.invalid) {
      this.codeForm.markAllAsTouched();
      return;
    }
    this.step = 'confirm';
  }

  protected onConfirmDelete(): void {
    this.errorMessage = '';
    this.isSubmitting = true;

    const password = this.passwordForm.getRawValue().password;
    const verificationCode = this.codeForm.getRawValue().verificationCode;

    this.authService
      .deleteMyAccount(password, verificationCode)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          this.authService.logout();
          void this.router.navigate(['/']);
        },
        error: (err: Error) => {
          this.errorMessage = err.message || 'Hesap silinemedi. Lütfen tekrar deneyin.';
          this.step = 'password';
          this.passwordForm.reset();
          this.codeForm.reset();
        },
      });
  }

  protected onCancelConfirm(): void {
    this.step = 'code';
  }

  protected isFieldInvalid(form: FormGroup, field: string): boolean {
    const control = form.get(field);
    return !!control && control.invalid && control.touched;
  }
}
