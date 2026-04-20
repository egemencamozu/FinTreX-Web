import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, signal } from '@angular/core';
import { AlertService } from '../../../../core/services/alert.service';

@Component({
  selector: 'app-confirmation-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirmation-modal.html',
  styleUrl: './confirmation-modal.scss',
})
export class ConfirmationModalComponent {
  protected readonly alertService = inject(AlertService);
  protected readonly state = this.alertService.activeConfirmation;

  protected isClosing = signal(false);

  @HostListener('window:keydown.escape')
  onEsc() {
    if (this.state()) {
      this.cancel();
    }
  }

  protected confirm() {
    this.close(true);
  }

  protected cancel() {
    this.close(false);
  }

  private close(result: boolean) {
    this.isClosing.set(true);
    // Give time for animation
    setTimeout(() => {
      const current = this.state();
      if (current) {
        current.resolve(result);
      }
      this.isClosing.set(false);
    }, 200);
  }
}
