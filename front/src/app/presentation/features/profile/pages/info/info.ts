import { Component, signal, computed, inject, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router } from '@angular/router';
import { UserRole } from '../../../../../core/enums/user-role.enum';
import { SubscriptionTier } from '../../../../../core/enums/subscription-tier.enum';
import { SubscriptionRepository } from '../../../../../core/interfaces/subscription.repository';
import { AuthService } from '../../../../../core/services/auth.service';
import mockProfile from '../../mock/user-profile.mock.json';
import mockSessions from '../../mock/user-sessions.mock.json';
import mockStats from '../../mock/user-stats.mock.json';

// ── Local interfaces ──────────────────────────────────────────────────────────

interface NotificationPrefs {
  emailPortfolioAlerts: boolean;
  emailPriceAlerts: boolean;
  emailMarketing: boolean;
  smsPortfolioAlerts: boolean;
  pushNotifications: boolean;
}

interface UserProfile {
  id: string;
  name: string;
  surname: string;
  email: string;
  phone: string;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  avatarUrl: string | null;
  createdAt: Date;
  lastLogin: Date;
  notifications: NotificationPrefs;
}

interface UserSession {
  id: string;
  device: string;
  location: string;
  ip: string;
  lastActive: Date;
  isCurrent: boolean;
}

interface UserStats {
  portfolioCount: number;
  assetCount: number;
  watchlistCount: number;
  membershipDays: number;
}

interface NotificationItem {
  key: keyof NotificationPrefs;
  label: string;
  description: string;
  icon: string;
}

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPass = control.get('newPassword')?.value;
  const confirm = control.get('confirmPassword')?.value;
  if (newPass && confirm && newPass !== confirm) {
    control.get('confirmPassword')?.setErrors({ mismatch: true });
    return { mismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-info',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './info.html',
  styleUrl: './info.scss',
})
export class Info implements OnInit {
  protected readonly UserRole = UserRole;
  protected readonly SubscriptionTier = SubscriptionTier;

  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly subscriptionRepository = inject(SubscriptionRepository);
  private readonly authService = inject(AuthService);

  // ── Data signals ──────────────────────────────────────────────────────────
  readonly user = signal<UserProfile>(this.initializeUser());

  readonly stats = signal<UserStats>(mockStats);

  readonly sessions = signal<UserSession[]>(
    mockSessions.map((s) => ({ ...s, lastActive: new Date(s.lastActive) })),
  );

  readonly notifications = signal<NotificationPrefs>({ ...mockProfile.notifications });

  // ── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.fetchSubscriptionData();
  }

  private fetchSubscriptionData(): void {
    this.subscriptionRepository.getMySubscription().subscribe({
      next: (sub) => {
        this.user.update((u) => ({
          ...u,
          subscriptionTier: sub.plan.tier,
        }));
      },
      error: (err) => console.error('Failed to fetch subscription:', err),
    });
  }

  private initializeUser(): UserProfile {
    const active = this.authService.getCurrentUser();
    if (active) {
      return {
        id: active.id,
        name: active.firstName,
        surname: active.lastName,
        email: active.email,
        phone: active.phoneNumber ?? '',
        role: active.role,
        subscriptionTier: active.subscriptionTier,
        avatarUrl: null,
        createdAt: new Date(),
        lastLogin: new Date(),
        notifications: mockProfile.notifications,
      };
    }
    return {
      ...mockProfile,
      role: mockProfile.role as UserRole,
      subscriptionTier: mockProfile.subscriptionTier as unknown as SubscriptionTier,
      avatarUrl: mockProfile.avatarUrl ?? null,
      createdAt: new Date(mockProfile.createdAt),
      lastLogin: new Date(mockProfile.lastLogin),
      notifications: mockProfile.notifications,
    };
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  readonly initials = computed(() => {
    const u = this.user();
    return `${u.name.charAt(0)}${u.surname.charAt(0)}`.toUpperCase();
  });

  // ── UI state ──────────────────────────────────────────────────────────────
  readonly avatarPreview = signal<string | null>(null);
  readonly isEditingInfo = signal(false);
  readonly infoSaveSuccess = signal(false);
  readonly passwordSaveSuccess = signal(false);
  readonly showCurrentPassword = signal(false);
  readonly showNewPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  // ── Notification items config ─────────────────────────────────────────────
  readonly notificationItems: NotificationItem[] = [
    {
      key: 'emailPortfolioAlerts',
      label: 'Portföy Uyarıları',
      description: 'Portföy değişimlerinde e-posta bildirimi al',
      icon: 'portfolio',
    },
    {
      key: 'emailPriceAlerts',
      label: 'Fiyat Alarmları',
      description: 'Takip listenizdeki varlıklarda fiyat değişimi olduğunda haber al',
      icon: 'price',
    },
    {
      key: 'emailMarketing',
      label: 'Kampanya ve Haberler',
      description: 'FinTreX güncellemeleri ve özel teklifler hakkında e-posta al',
      icon: 'marketing',
    },
    {
      key: 'smsPortfolioAlerts',
      label: 'SMS Uyarıları',
      description: 'Kritik portföy değişimlerinde SMS bildirimi al',
      icon: 'sms',
    },
    {
      key: 'pushNotifications',
      label: 'Anlık Bildirimler',
      description: 'Tarayıcı üzerinden anlık bildirimler al',
      icon: 'push',
    },
  ];

  // ── Forms ────────────────────────────────────────────────────────────────
  readonly infoForm: FormGroup = this.fb.group({
    name: [this.user().name, [Validators.required, Validators.minLength(2)]],
    surname: [this.user().surname, [Validators.required, Validators.minLength(2)]],
    email: [this.user().email, [Validators.required, Validators.email]],
    phone: [this.user().phone],
  });

  readonly passwordForm: FormGroup = this.fb.group(
    {
      currentPassword: ['', [Validators.required, Validators.minLength(8)]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator },
  );

  // ── Avatar ───────────────────────────────────────────────────────────────
  onAvatarChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => this.avatarPreview.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  triggerAvatarInput(): void {
    const input = document.getElementById('avatar-upload') as HTMLInputElement;
    input?.click();
  }

  // ── Info form ────────────────────────────────────────────────────────────
  startEditing(): void {
    this.infoForm.patchValue({
      name: this.user().name,
      surname: this.user().surname,
      email: this.user().email,
      phone: this.user().phone,
    });
    this.isEditingInfo.set(true);
    this.infoSaveSuccess.set(false);
  }

  cancelEditing(): void {
    this.isEditingInfo.set(false);
    this.infoForm.markAsUntouched();
  }

  saveInfo(): void {
    if (this.infoForm.invalid) {
      this.infoForm.markAllAsTouched();
      return;
    }
    this.user.update((u) => ({ ...u, ...this.infoForm.value }));
    this.isEditingInfo.set(false);
    this.infoSaveSuccess.set(true);
    setTimeout(() => this.infoSaveSuccess.set(false), 4000);
  }

  // ── Password form ────────────────────────────────────────────────────────
  savePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.passwordSaveSuccess.set(true);
    this.passwordForm.reset();
    setTimeout(() => this.passwordSaveSuccess.set(false), 4000);
  }

  // ── Notifications ────────────────────────────────────────────────────────
  toggleNotification(key: keyof NotificationPrefs): void {
    this.notifications.update((prefs) => ({ ...prefs, [key]: !prefs[key] }));
  }

  // ── Sessions ─────────────────────────────────────────────────────────────
  terminateSession(sessionId: string): void {
    this.sessions.update((list) => list.filter((s) => s.id !== sessionId));
  }

  getDeviceType(device: string): 'mobile' | 'tablet' | 'desktop' {
    const d = device.toLowerCase();
    if (d.includes('iphone') || d.includes('android') || d.includes('mobile')) return 'mobile';
    if (d.includes('ipad') || d.includes('tablet')) return 'tablet';
    return 'desktop';
  }

  // ── Navigation ───────────────────────────────────────────────────────────
  navigateToSubscription(): void {
    this.router.navigate(['/app/subscription/manage']);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  getSubscriptionLabel(): string {
    const labels: Record<SubscriptionTier, string> = {
      [SubscriptionTier.Default]: 'Standart',
      [SubscriptionTier.Premium]: 'Premium',
      [SubscriptionTier.Ultra]: 'Ultra',
    };
    return labels[this.user().subscriptionTier];
  }

  getRoleLabel(): string {
    const labels: Record<UserRole, string> = {
      [UserRole.USER]: 'Bireysel Yatırımcı',
      [UserRole.ECONOMIST]: 'Ekonomist',
      [UserRole.ADMIN]: 'Yönetici',
    };
    return labels[this.user().role];
  }

  getSubscriptionFeatures(): string[] {
    const features: Record<SubscriptionTier, string[]> = {
      [SubscriptionTier.Default]: [
        'Sınırlı portföy oluşturma',
        'Temel piyasa verileri',
        'Rastgele ekonomist ataması',
        'Günlük mesaj limiti',
      ],
      [SubscriptionTier.Premium]: [
        'Gelişmiş portföy yönetimi',
        'Gerçek zamanlı piyasa verileri',
        'Ekonomist seçimi',
        'Yüksek mesaj limiti',
        'Öncelikli destek',
      ],
      [SubscriptionTier.Ultra]: [
        'Sınırsız portföy',
        'Gerçek zamanlı + geçmiş veriler',
        'Öncelikli ekonomist seçimi',
        'Neredeyse sınırsız mesaj',
        'VIP destek',
        'Özel analizler',
      ],
    };
    return features[this.user().subscriptionTier];
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  hasError(form: FormGroup, field: string, error: string): boolean {
    const control = form.get(field);
    return !!(control?.hasError(error) && control.touched);
  }
}
