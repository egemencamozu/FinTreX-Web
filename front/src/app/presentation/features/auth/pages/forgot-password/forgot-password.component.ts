import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  protected readonly forgotPasswordForm: FormGroup;
  protected errorMessage = '';
  protected successMessage = '';
  protected isSubmitting = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
  ) {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  protected onSubmit(): void {
    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.isSubmitting = true;

    const { email } = this.forgotPasswordForm.getRawValue();

    this.authService
      .forgotPassword(email)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (response) => {
          this.successMessage =
            response.message || 'Eger email sistemde kayitliysa sifirlama linki gonderilecektir.';
        },
        error: (error: Error) => {
          this.errorMessage =
            error.message || 'Sifremi unuttum istegi gonderilirken bir hata olustu.';
        },
      });
  }

  protected isFieldInvalid(fieldName: string): boolean {
    const control = this.forgotPasswordForm.get(fieldName);
    return !!control && control.invalid && control.touched;
  }
}
