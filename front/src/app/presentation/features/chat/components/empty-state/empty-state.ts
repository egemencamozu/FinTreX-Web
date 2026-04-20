import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { inject } from '@angular/core';
import { AuthService } from '../../../../../core/services/auth.service';
import { UserRole } from '../../../../../core/enums/user-role.enum';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="empty-state">
      <div class="empty-state__container">
        <div class="empty-state__icon">
          <i class="fas fa-comments"></i>
        </div>
        <h2 class="empty-state__title">Sohbetlerinize Hoş Geldiniz</h2>
        <p class="empty-state__description">
          {{ canStartNewChat ? 'Ekonomistinizle iletişime geçmek için soldaki listeden bir sohbet seçin veya yepyeni bir konu başlatın.' 
                             : 'İletişime geçmek için soldaki listeden bir sohbet seçin.' }}
        </p>
        @if (canStartNewChat) {
          <button class="empty-state__cta" (click)="newChat.emit()">
            <i class="fas fa-plus"></i> Yeni Sohbet Başlat
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1;
    }

    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      background: transparent;
      padding: 2rem;

      &__container {
        text-align: center;
        max-width: 420px;
        animation: emptyFadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      }

      &__icon {
        font-size: 5rem;
        margin-bottom: 1.5rem;
        color: var(--color-navy-300);
        opacity: 0.8;
      }

      &__title {
        color: var(--text-primary);
        font-size: 1.75rem;
        font-weight: 800;
        margin-bottom: 1rem;
        letter-spacing: -0.02em;
      }

      &__description {
        color: var(--text-secondary);
        font-size: 1.05rem;
        line-height: 1.6;
        font-weight: 400;
        margin-bottom: 2rem;
      }

      &__cta {
        padding: 0.75rem 1.5rem;
        background: var(--btn-primary-bg);
        color: var(--btn-primary-text);
        font-family: inherit;
        font-weight: var(--font-weight-semibold);
        font-size: var(--font-size-base);
        border: none;
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: var(--transition-all);
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        
        &:hover {
          background: var(--btn-primary-bg-hover);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
      }
    }

    @keyframes emptyFadeIn {
      from { opacity: 0; transform: translateY(15px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `]
})
export class EmptyStateComponent {
  @Output() newChat = new EventEmitter<void>();

  private authService = inject(AuthService);

  get canStartNewChat(): boolean {
    return this.authService.hasRole(UserRole.USER) || this.authService.hasRole(UserRole.ADMIN);
  }
}
