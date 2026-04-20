import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AlertContainerComponent } from './presentation/shared/components/alert-container/alert-container.component';
import { ConfirmationModalComponent } from './presentation/shared/components/confirmation-modal/confirmation-modal';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, AlertContainerComponent, ConfirmationModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
