import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../../core/services/auth.service';
import { EmailNotConfirmedError } from '../../../../../core/errors/email-not-confirmed.error';
import { VerifyEmailModalComponent } from '../../components/verify-email-modal/verify-email-modal.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, VerifyEmailModalComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  protected readonly loginForm: FormGroup;
  protected errorMessage = '';
  protected isSubmitting = false;
  protected showVerifyModal = false;
  protected pendingEmail = '';

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {
    if (this.authService.isAuthenticated()) {
      void this.router.navigateByUrl(this.authService.getRedirectUrl());
    }

    this.loginForm = this.fb.group({
      email: [
        this.route.snapshot.queryParamMap.get('email') ?? '',
        [Validators.required, Validators.email],
      ],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false],
    });
  }

  protected onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.errorMessage = '';
    this.isSubmitting = true;

    const { email, password, rememberMe } = this.loginForm.getRawValue();

    this.authService
      .login({ email, password }, rememberMe)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          const redirectUrl = this.route.snapshot.queryParamMap.get('redirectUrl');
          void this.router.navigateByUrl(redirectUrl || this.authService.getRedirectUrl());
        },
        error: (error: Error) => {
          if (error instanceof EmailNotConfirmedError) {
            this.pendingEmail = error.email || email;
            this.showVerifyModal = true;
            return;
          }
          this.errorMessage = error.message || 'Giris yapilirken bir hata olustu.';
        },
      });
  }

  protected isFieldInvalid(fieldName: string): boolean {
    const control = this.loginForm.get(fieldName);
    return !!control && control.invalid && control.touched;
  }

  protected onForgotPasswordClick(): void {
    void this.router.navigate(['/auth/forgot-password']);
  }

  protected onVerifyModalClosed(): void {
    this.showVerifyModal = false;
  }

  protected onVerified(): void {
    this.showVerifyModal = false;
    // Redirect handled inside VerifyEmailModalComponent via AuthService.getRedirectUrl().
  }
}
