import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { SubscriptionStatus } from '../../../../../core/enums/subscription-status.enum';
import { SubscriptionTier } from '../../../../../core/enums/subscription-tier.enum';
import { UserRole } from '../../../../../core/enums/user-role.enum';
import { AccountRepository } from '../../../../../core/interfaces/account.repository';
import { PortfolioRepository } from '../../../../../core/interfaces/portfolio.repository';
import { SubscriptionRepository } from '../../../../../core/interfaces/subscription.repository';
import { UserManagementRepository } from '../../../../../core/interfaces/user-management.repository';
import { Portfolio } from '../../../../../core/models/portfolio.model';
import { Session } from '../../../../../core/models/session.model';
import { UserSubscription } from '../../../../../core/models/subscription.model';
import { UserSummary } from '../../../../../core/models/user-summary.model';
import { AuthService } from '../../../../../core/services/auth.service';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';
type DeleteStep = 'password' | 'code' | 'confirm';
type SecurityPanel = 'password' | 'delete';

interface StatCard {
  key: 'portfolios' | 'assets' | 'membershipDays' | 'subscriptionDays';
  value: string;
  label: string;
}

@Component({
  selector: 'app-info',
  standalone: true,
  imports: [ReactiveFormsModule, KpiCardComponent],
  templateUrl: './info.html',
  styleUrl: './info.scss',
})
export class Info implements OnInit {
  protected readonly SubscriptionTier = SubscriptionTier;

  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly userRepo = inject(UserManagementRepository);
  private readonly subscriptionRepo = inject(SubscriptionRepository);
  private readonly portfolioRepo = inject(PortfolioRepository);
  private readonly accountRepo = inject(AccountRepository);
  private readonly authService = inject(AuthService);

  // ── Profile state ─────────────────────────────────────────────────────
  readonly status = signal<LoadStatus>('idle');
  readonly errorMessage = signal<string | null>(null);
  readonly profile = signal<UserSummary | null>(null);
  readonly subscription = signal<UserSubscription | null>(null);
  readonly portfolios = signal<Portfolio[]>([]);

  readonly isEditing = signal(false);
  readonly isSaving = signal(false);
  readonly saveSuccess = signal(false);
  readonly saveError = signal<string | null>(null);

  // ── Password state ────────────────────────────────────────────────────
  readonly isPasswordSaving = signal(false);
  readonly passwordSuccess = signal(false);
  readonly passwordError = signal<string | null>(null);
  readonly securityPanel = signal<SecurityPanel>('password');

  // ── Sessions state ────────────────────────────────────────────────────
  readonly sessions = signal<Session[]>([]);
  readonly sessionsStatus = signal<LoadStatus>('idle');
  readonly sessionsError = signal<string | null>(null);
  readonly revokingSessionId = signal<number | null>(null);
  readonly isRevokingOthers = signal(false);

  // ── Delete account state ──────────────────────────────────────────────
  readonly deleteStep = signal<DeleteStep>('password');
  readonly isDeleting = signal(false);
  readonly deleteError = signal<string | null>(null);

  // ── Forms ─────────────────────────────────────────────────────────────
  readonly profileForm: FormGroup = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
    lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
    phoneNumber: ['', [Validators.pattern(/^[+0-9\s()-]{7,20}$/)]],
  });

  readonly passwordForm: FormGroup = this.fb.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(100)]],
      confirmNewPassword: ['', [Validators.required]],
    },
    { validators: this.passwordMatchValidator },
  );

  readonly deletePasswordForm: FormGroup = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly deleteCodeForm: FormGroup = this.fb.group({
    verificationCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  // ── Computed ──────────────────────────────────────────────────────────
  readonly initials = computed(() => {
    const p = this.profile();
    if (!p) return '';
    return `${p.firstName?.charAt(0) ?? ''}${p.lastName?.charAt(0) ?? ''}`.toUpperCase();
  });

  readonly roleLabel = computed(() => {
    const raw = (this.profile()?.role ?? '').toUpperCase();
    switch (raw) {
      case 'ADMIN': return 'Yönetici';
      case 'ECONOMIST': return 'Ekonomist';
      case 'USER': return 'Bireysel Yatırımcı';
      default: return raw || '—';
    }
  });

  readonly subscriptionTier = computed<SubscriptionTier>(
    () => this.subscription()?.plan?.tier ?? SubscriptionTier.Default,
  );

  readonly subscriptionLabel = computed(() => {
    switch (this.subscriptionTier()) {
      case SubscriptionTier.Premium: return 'Premium';
      case SubscriptionTier.Ultra: return 'Ultra';
      default: return 'Standart';
    }
  });

  readonly subscriptionStatusLabel = computed(() => {
    const s = this.subscription();
    if (!s) return null;
    switch (s.status) {
      case SubscriptionStatus.ACTIVE: return 'Aktif';
      case SubscriptionStatus.CANCELLED: return 'İptal Edildi';
      case SubscriptionStatus.EXPIRED: return 'Süresi Doldu';
      default: return String(s.status);
    }
  });

  readonly accountStatus = computed<'active' | 'deactivated' | 'unverified'>(() => {
    const p = this.profile();
    if (!p) return 'active';
    if (!p.isActive) return 'deactivated';
    if (!p.emailConfirmed) return 'unverified';
    return 'active';
  });

  readonly isAdmin = computed(() => this.profile()?.role?.toUpperCase() === UserRole.ADMIN);
  readonly isEconomist = computed(() => this.profile()?.role?.toUpperCase() === UserRole.ECONOMIST);

  readonly stats = computed<StatCard[]>(() => {
    const portfolios = this.portfolios();
    const profile = this.profile();
    const sub = this.subscription();

    const portfolioCount = portfolios.length;
    const assetCount = portfolios.reduce((sum, p) => sum + (p.assets?.length ?? 0), 0);
    const membershipDays = profile?.createdAt
      ? this.daysBetween(new Date(profile.createdAt), new Date())
      : 0;
    const subscriptionDays = sub?.currentPeriodEndUtc
      ? Math.max(0, this.daysBetween(new Date(), new Date(sub.currentPeriodEndUtc)))
      : null;

    return [
      { key: 'portfolios', value: String(portfolioCount), label: 'Portföy' },
      { key: 'assets', value: String(assetCount), label: 'Toplam Varlık' },
      { key: 'membershipDays', value: String(membershipDays), label: 'Gün Üye' },
      { key: 'subscriptionDays', value: subscriptionDays === null ? '—' : String(subscriptionDays), label: 'Abonelik Kalan Gün' },
    ];
  });

  readonly otherSessionsCount = computed(() => this.sessions().filter((s) => !s.isCurrent).length);

  // ── Lifecycle ─────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadAll();
    this.loadSessions();
  }

  loadAll(): void {
    this.status.set('loading');
    this.errorMessage.set(null);

    forkJoin({
      profile: this.userRepo.getMyProfile(),
      subscription: this.subscriptionRepo.getMySubscription(),
      portfolios: this.portfolioRepo.getMyPortfolios(),
    }).subscribe({
      next: ({ profile, subscription, portfolios }) => {
        this.profile.set(profile);
        this.subscription.set(subscription);
        this.portfolios.set(portfolios);
        this.status.set('ready');
      },
      error: (err: Error) => {
        this.errorMessage.set(err.message || 'Profil bilgileri yüklenemedi.');
        this.status.set('error');
      },
    });
  }

  // ── Edit profile ──────────────────────────────────────────────────────
  startEditing(): void {
    const p = this.profile();
    if (!p) return;
    this.profileForm.reset({ firstName: p.firstName, lastName: p.lastName, phoneNumber: p.phoneNumber ?? '' });
    this.saveSuccess.set(false);
    this.saveError.set(null);
    this.isEditing.set(true);
  }

  cancelEditing(): void {
    this.isEditing.set(false);
    this.saveError.set(null);
    this.profileForm.markAsUntouched();
  }

  saveProfile(): void {
    if (this.profileForm.invalid) { this.profileForm.markAllAsTouched(); return; }
    const raw = this.profileForm.getRawValue();
    const phone = (raw.phoneNumber ?? '').trim();
    this.isSaving.set(true);
    this.saveError.set(null);
    this.userRepo.updateMyProfile({
      firstName: raw.firstName.trim(),
      lastName: raw.lastName.trim(),
      phoneNumber: phone === '' ? undefined : phone,
    }).subscribe({
      next: (updated) => {
        this.profile.set(updated);
        this.isSaving.set(false);
        this.isEditing.set(false);
        this.saveSuccess.set(true);
        setTimeout(() => this.saveSuccess.set(false), 4000);
      },
      error: (err: Error) => {
        this.isSaving.set(false);
        this.saveError.set(err.message || 'Kayıt sırasında hata oluştu.');
      },
    });
  }

  // ── Password ──────────────────────────────────────────────────────────
  setSecurityPanel(panel: SecurityPanel): void {
    this.securityPanel.set(panel);
    if (panel === 'password') {
      this.deleteError.set(null);
    } else {
      this.passwordError.set(null);
      this.passwordSuccess.set(false);
    }
  }

  submitPasswordChange(): void {
    if (this.passwordForm.invalid) { this.passwordForm.markAllAsTouched(); return; }
    const raw = this.passwordForm.getRawValue();
    this.isPasswordSaving.set(true);
    this.passwordError.set(null);
    this.accountRepo.changePassword({
      currentPassword: raw.currentPassword,
      newPassword: raw.newPassword,
      confirmNewPassword: raw.confirmNewPassword,
    }).subscribe({
      next: () => {
        this.isPasswordSaving.set(false);
        this.passwordForm.reset({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
        this.passwordForm.markAsPristine();
        this.passwordForm.markAsUntouched();
        this.passwordSuccess.set(true);
        setTimeout(() => this.passwordSuccess.set(false), 4000);
      },
      error: (err: Error) => {
        this.isPasswordSaving.set(false);
        this.passwordError.set(err.message || 'Şifre değiştirilemedi.');
      },
    });
  }

  hasPasswordError(field: string, error: string): boolean {
    const c = this.passwordForm.get(field);
    return !!(c?.hasError(error) && c.touched);
  }

  hasPasswordFormError(error: string): boolean {
    return !!(this.passwordForm.hasError(error) && this.passwordForm.get('confirmNewPassword')?.touched);
  }

  // ── Sessions ──────────────────────────────────────────────────────────
  loadSessions(): void {
    this.sessionsStatus.set('loading');
    this.sessionsError.set(null);
    this.accountRepo.getSessions().subscribe({
      next: (list) => { this.sessions.set(list); this.sessionsStatus.set('ready'); },
      error: (err: Error) => {
        this.sessionsError.set(err.message || 'Oturumlar yüklenemedi.');
        this.sessionsStatus.set('error');
      },
    });
  }

  revokeSession(session: Session): void {
    if (session.isCurrent) return;
    this.revokingSessionId.set(session.id);
    this.accountRepo.revokeSession(session.id).subscribe({
      next: () => { this.sessions.set(this.sessions().filter((s) => s.id !== session.id)); this.revokingSessionId.set(null); },
      error: (err: Error) => { this.revokingSessionId.set(null); this.sessionsError.set(err.message || 'Oturum sonlandırılamadı.'); },
    });
  }

  revokeOtherSessions(): void {
    if (this.otherSessionsCount() === 0) return;
    this.isRevokingOthers.set(true);
    this.accountRepo.revokeOtherSessions().subscribe({
      next: () => { this.sessions.set(this.sessions().filter((s) => s.isCurrent)); this.isRevokingOthers.set(false); },
      error: (err: Error) => { this.isRevokingOthers.set(false); this.sessionsError.set(err.message || 'Diğer oturumlar sonlandırılamadı.'); },
    });
  }

  // ── Delete account ────────────────────────────────────────────────────
  onDeletePasswordSubmit(): void {
    if (this.deletePasswordForm.invalid) { this.deletePasswordForm.markAllAsTouched(); return; }
    this.deleteError.set(null);
    this.isDeleting.set(true);
    const { password } = this.deletePasswordForm.getRawValue();
    this.authService.requestAccountDeletionCode(password)
      .pipe(finalize(() => this.isDeleting.set(false)))
      .subscribe({
        next: () => this.deleteStep.set('code'),
        error: (err: Error) => this.deleteError.set(err.message || 'Bir hata oluştu. Lütfen tekrar deneyin.'),
      });
  }

  onDeleteCodeSubmit(): void {
    if (this.deleteCodeForm.invalid) { this.deleteCodeForm.markAllAsTouched(); return; }
    this.deleteStep.set('confirm');
  }

  onConfirmDelete(): void {
    this.deleteError.set(null);
    this.isDeleting.set(true);
    const password = this.deletePasswordForm.getRawValue().password;
    const verificationCode = this.deleteCodeForm.getRawValue().verificationCode;
    this.authService.deleteMyAccount(password, verificationCode)
      .pipe(finalize(() => this.isDeleting.set(false)))
      .subscribe({
        next: () => { this.authService.logout(); void this.router.navigate(['/']); },
        error: (err: Error) => {
          this.deleteError.set(err.message || 'Hesap silinemedi. Lütfen tekrar deneyin.');
          this.deleteStep.set('password');
          this.deletePasswordForm.reset();
          this.deleteCodeForm.reset();
        },
      });
  }

  onDeleteCancel(): void {
    this.deleteStep.set('password');
    this.deleteError.set(null);
    this.deletePasswordForm.reset();
    this.deleteCodeForm.reset();
  }

  isDeleteFieldInvalid(field: string): boolean {
    const c = this.deletePasswordForm.get(field);
    return !!(c?.invalid && c.touched);
  }

  isDeleteCodeFieldInvalid(field: string): boolean {
    const c = this.deleteCodeForm.get(field);
    return !!(c?.invalid && c.touched);
  }

  // ── Navigation ────────────────────────────────────────────────────────
  goToSubscription(): void {
    void this.router.navigate(['/app/subscription/manage']);
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  hasFieldError(field: string, error: string): boolean {
    const c = this.profileForm.get(field);
    return !!(c?.hasError(error) && c.touched);
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  private passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const newPwd = group.get('newPassword')?.value;
    const confirm = group.get('confirmNewPassword')?.value;
    if (!newPwd || !confirm) return null;
    return newPwd === confirm ? null : { passwordMismatch: true };
  }

  private daysBetween(from: Date, to: Date): number {
    return Math.max(0, Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
  }
}
