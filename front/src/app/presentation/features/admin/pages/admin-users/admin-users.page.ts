import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AdminSection } from '../../models/admin-section.model';

@Component({
  selector: 'app-admin-users-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-users.page.html',
  styleUrl: './admin-users.page.scss',
})
export class AdminUsersPage {
  protected readonly sections: AdminSection[] = [
    {
      title: 'Kullanici hesaplari',
      description: 'Askıya alma, ban ve durum izleme islemleri.',
      highlight: 'Hesap yonetimi',
    },
    {
      title: 'Ekonomist hesaplari',
      description: 'Danisman profilleri ve yetki durumlari.',
      highlight: 'Rol bazli kontrol',
    },
  ];
}
