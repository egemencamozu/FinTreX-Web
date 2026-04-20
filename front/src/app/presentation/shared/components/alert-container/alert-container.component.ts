import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertService } from '../../../../core/services/alert.service';

@Component({
  selector: 'app-alert-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="alert-container">
      @for (alert of alertService.alerts(); track alert.id) {
        <div class="alert-toast" [class]="'alert-toast--' + alert.type">
          <div class="alert-toast__icon">
            @switch (alert.type) {
              @case ('success') { <i class="fa-solid fa-circle-check"></i> }
              @case ('error') { <i class="fa-solid fa-circle-xmark"></i> }
              @case ('warning') { <i class="fa-solid fa-triangle-exclamation"></i> }
              @case ('info') { <i class="fa-solid fa-circle-info"></i> }
            }
          </div>
          <div class="alert-toast__message">{{ alert.message }}</div>
          <button class="alert-toast__close" (click)="alertService.dismiss(alert.id)">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .alert-container {
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
    }
    .alert-toast {
      pointer-events: auto;
      min-width: 300px;
      max-width: 450px;
      padding: 16px;
      border-radius: var(--radius-lg);
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-lg);
      display: flex;
      align-items: center;
      gap: 12px;
      animation: slideIn 0.3s var(--ease-bounce);
      
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }

      &--success { border-left: 4px solid var(--color-success-500); .alert-toast__icon { color: var(--color-success-500); } }
      &--error { border-left: 4px solid var(--color-danger-500); .alert-toast__icon { color: var(--color-danger-500); } }
      &--warning { border-left: 4px solid var(--color-warning-500); .alert-toast__icon { color: var(--color-warning-500); } }
      &--info { border-left: 4px solid var(--color-info-600); .alert-toast__icon { color: var(--color-info-600); } }
    }
    .alert-toast__icon { font-size: 20px; flex-shrink: 0; }
    .alert-toast__message { flex: 1; font-size: 14px; font-weight: 500; color: var(--text-primary); }
    .alert-toast__close {
      background: none; border: none; color: var(--text-tertiary); cursor: pointer;
      padding: 4px; border-radius: 4px; transition: background 0.2s;
      &:hover { background: var(--state-hover); color: var(--text-primary); }
    }
  `]
})
export class AlertContainerComponent {
  protected readonly alertService = inject(AlertService);
}
