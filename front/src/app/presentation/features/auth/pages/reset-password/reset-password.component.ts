import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent {
  protected readonly resetPasswordForm: FormGroup;
  protected errorMessage = '';
  protected successMessage = '';
  protected isSubmitting = false;
  protected linkValid = true;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {
    const email = this.route.snapshot.queryParamMap.get('email') ?? '';
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';

    this.resetPasswordForm = this.fb.group(
      {
        email: [email, [Validators.required, Validators.email]],
        token: [token, [Validators.required]],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: ResetPasswordComponent.passwordsMatch },
    );

    if (!email || !token) {
      this.linkValid = false;
      this.errorMessage = 'Sifre yenileme baglantisi gecersiz veya eksik.';
    }
  }

  private static passwordsMatch(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordsMismatch: true };
  }

  protected onSubmit(): void {
    if (!this.linkValid) {
      return;
    }

    if (this.resetPasswordForm.invalid) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.isSubmitting = true;

    const { email, token, password, confirmPassword } = this.resetPasswordForm.getRawValue();

    this.authService
      .resetPassword(email, token, password, confirmPassword)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (response) => {
          this.successMessage = response.message || 'Sifreniz basariyla yenilendi.';
          setTimeout(() => {
            void this.router.navigate(['/auth/login'], { queryParams: { email } });
          }, 1200);
        },
        error: (error: Error) => {
          this.errorMessage = error.message || 'Sifre sifirlama islemi sirasinda bir hata olustu.';
        },
      });
  }

  protected isFieldInvalid(fieldName: string): boolean {
    const control = this.resetPasswordForm.get(fieldName);
    return !!control && control.invalid && control.touched;
  }

  protected hasPasswordMismatch(): boolean {
    return (
      !!this.resetPasswordForm.hasError('passwordsMismatch') &&
      !!this.resetPasswordForm.get('confirmPassword')?.touched
    );
  }
}
