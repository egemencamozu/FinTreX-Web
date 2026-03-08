import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AdminSection } from '../../models/admin-section.model';

@Component({
  selector: 'app-admin-settings-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-settings.page.html',
  styleUrl: './admin-settings.page.scss',
})
export class AdminSettingsPage {
  protected readonly sections: AdminSection[] = [
    {
      title: 'Abonelik limitleri',
      description: 'Dinamik plan sinirlari ve kullanici kotalari.',
      highlight: 'Konfigurasyon',
    },
    {
      title: 'Performans denetimi',
      description: 'Ekonomist metrikleri ve panel bazli izleme ekranlari.',
      highlight: 'Audit',
    },
  ];
}
