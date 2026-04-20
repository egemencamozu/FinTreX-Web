import { Injectable, signal } from '@angular/core';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface AlertMessage {
  id: number;
  type: AlertType;
  message: string;
  duration?: number;
}

export interface ConfirmationRequest {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (result: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class AlertService {
  private nextId = 0;
  readonly alerts = signal<AlertMessage[]>([]);
  readonly activeConfirmation = signal<ConfirmationRequest | null>(null);

  /**
   * Ekranda toast bildirimi gösterir.
   * @param type - 'success' | 'error' | 'warning' | 'info'
   * @param message - Kullanıcıya gösterilecek mesaj.
   * @param duration - Otomatik kapanma süresi (ms). Varsayılan 4000.
   */
  show(type: AlertType, message: string, duration = 4000): void {
    const id = this.nextId++;
    this.alerts.update(list => [...list, { id, type, message, duration }]);
    
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }

  success(message: string, duration = 4000): void {
    this.show('success', message, duration);
  }

  error(message: string, duration = 4000): void {
    this.show('error', message, duration);
  }

  info(message: string, duration = 4000): void {
    this.show('info', message, duration);
  }

  warning(message: string, duration = 4000): void {
    this.show('warning', message, duration);
  }

  /** Belirli bir toast'u kapatır. */
  dismiss(id: number): void {
    this.alerts.update(list => list.filter(a => a.id !== id));
  }

  /** 
   * Asenkron onay dialogu — Promise<boolean> döner. 
   * Özel hazırlanan ConfirmationModalComponent tarafından dinlenir.
   */
  confirm(message: string, options?: Partial<Omit<ConfirmationRequest, 'message' | 'resolve'>>): Promise<boolean> {
    return new Promise((resolve) => {
      this.activeConfirmation.set({
        message,
        title: options?.title || 'Onay Gerekli',
        confirmLabel: options?.confirmLabel || 'Tamam',
        cancelLabel: options?.cancelLabel || 'İptal',
        resolve: (result: boolean) => {
          this.activeConfirmation.set(null);
          resolve(result);
        }
      });
    });
  }
}
