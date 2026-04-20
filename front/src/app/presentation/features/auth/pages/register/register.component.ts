import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { UserRole } from '../../../../../core/enums/user-role.enum';
import { AuthService } from '../../../../../core/services/auth.service';
import { VerifyEmailModalComponent } from '../../components/verify-email-modal/verify-email-modal.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, VerifyEmailModalComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  protected readonly registerForm: FormGroup;
  protected readonly UserRole = UserRole;
  protected errorMessage = '';
  protected successMessage = '';
  protected isSubmitting = false;
  protected showVerifyModal = false;
  protected pendingEmail = '';

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    if (this.authService.isAuthenticated()) {
      void this.router.navigateByUrl(this.authService.getRedirectUrl());
    }

    this.registerForm = this.fb.group(
      {
        firstName: ['', [Validators.required, Validators.minLength(2)]],
        lastName: ['', [Validators.required, Validators.minLength(2)]],
        email: ['', [Validators.required, Validators.email]],
        phoneNumber: [''],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]],
        role: [UserRole.USER, [Validators.required]],
      },
      { validators: RegisterComponent.passwordsMatch },
    );
  }

  private static passwordsMatch(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return password === confirm ? null : { passwordsMismatch: true };
  }

  protected onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.isSubmitting = true;

    const { firstName, lastName, email, phoneNumber, password, confirmPassword, role } =
      this.registerForm.getRawValue();

    const userName = email.split('@')[0];

    this.authService
      .register({ firstName, lastName, email, userName, phoneNumber, password, confirmPassword, role })
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (response) => {
          this.pendingEmail = response.email || email;
          this.showVerifyModal = true;
        },
        error: (error: Error) => {
          this.errorMessage = error.message || 'Kayıt olurken bir hata oluştu.';
        },
      });
  }

  protected onVerifyModalClosed(): void {
    this.showVerifyModal = false;
    void this.router.navigate(['/auth/login'], {
      queryParams: { email: this.pendingEmail },
    });
  }

  protected onVerified(): void {
    this.showVerifyModal = false;
    // Router navigation is handled inside the modal via AuthService.getRedirectUrl().
  }

  protected isFieldInvalid(fieldName: string): boolean {
    const control = this.registerForm.get(fieldName);
    return !!control && control.invalid && control.touched;
  }
}
