import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-forbidden-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="forbidden">
      <div class="forbidden__card">
        <span class="forbidden__icon">
          <i class="fa-solid fa-shield-halved"></i>
        </span>
        <h1 class="forbidden__title">Erişim Engellendi</h1>
        <p class="forbidden__desc">
          Bu sayfayı görüntülemek için yetkiniz bulunmuyor. Eğer bunun bir hata olduğunu
          düşünüyorsanız yöneticinize başvurun.
        </p>
        <div class="forbidden__actions">
          <a class="forbidden__btn forbidden__btn--primary" [routerLink]="redirectUrl">
            <i class="fa-solid fa-arrow-left"></i> Ana Sayfaya Dön
          </a>
          <a class="forbidden__btn forbidden__btn--secondary" routerLink="/auth/login">
            <i class="fa-solid fa-right-to-bracket"></i> Farklı Hesapla Giriş Yap
          </a>
        </div>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .forbidden {
      display: grid;
      place-items: center;
      min-height: 80vh;
      padding: var(--space-8);
    }

    .forbidden__card {
      display: grid;
      gap: var(--space-5);
      max-width: 28rem;
      padding: var(--space-10);
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: var(--radius-2xl, 1.5rem);
      background: rgba(255, 255, 255, 0.78);
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.1);
      backdrop-filter: blur(10px);
      text-align: center;
    }

    .forbidden__icon {
      display: grid;
      place-items: center;
      width: var(--space-16, 4rem);
      height: var(--space-16, 4rem);
      margin: 0 auto;
      border-radius: var(--radius-full);
      background: var(--bg-danger-subtle, #fef2f2);
      color: var(--text-danger, #ef4444);
      font-size: var(--font-size-2xl, 1.5rem);
    }

    .forbidden__title {
      margin: 0;
      color: var(--text-primary);
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-bold);
      letter-spacing: var(--tracking-tight);
    }

    .forbidden__desc {
      margin: 0;
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      line-height: var(--leading-relaxed);
    }

    .forbidden__actions {
      display: grid;
      gap: var(--space-3);
    }

    .forbidden__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      height: var(--space-11, 2.75rem);
      border: 0;
      border-radius: var(--radius-lg);
      font: inherit;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-bold);
      text-decoration: none;
      cursor: pointer;
      transition: all var(--duration-fast) var(--ease-default);
    }

    .forbidden__btn--primary {
      background: linear-gradient(135deg, var(--color-navy-700), var(--color-navy-800));
      color: var(--btn-primary-text, #fff);
    }

    .forbidden__btn--primary:hover {
      background: linear-gradient(135deg, var(--color-navy-800), var(--color-navy-900));
      box-shadow: var(--shadow-lg);
      transform: translateY(-1px);
    }

    .forbidden__btn--secondary {
      border: 1px solid var(--border-default);
      background: var(--bg-surface);
      color: var(--text-primary);
    }

    .forbidden__btn--secondary:hover {
      border-color: var(--border-strong);
      box-shadow: var(--shadow-xs);
    }
  `,
})
export class ForbiddenPage {
  protected readonly redirectUrl: string;

  constructor(private readonly authService: AuthService) {
    try {
      this.redirectUrl = this.authService.getRedirectUrl();
    } catch {
      this.redirectUrl = '/';
    }
  }
}
