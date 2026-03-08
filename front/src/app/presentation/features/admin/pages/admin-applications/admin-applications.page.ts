import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AdminSection } from '../../models/admin-section.model';

@Component({
  selector: 'app-admin-applications-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-applications.page.html',
  styleUrl: './admin-applications.page.scss',
})
export class AdminApplicationsPage {
  protected readonly sections: AdminSection[] = [
    {
      title: 'Ekonomist basvurulari',
      description: 'Onay, red ve dokuman inceleme akislari.',
      highlight: 'Basvuru sirasi',
    },
    {
      title: 'Degisiklik talepleri',
      description: 'Rol, profil ve durum guncelleme taleplerinin denetimi.',
      highlight: 'Inceleme sureci',
    },
  ];
}
