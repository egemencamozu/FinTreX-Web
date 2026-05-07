import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeToggleComponent } from '../../../../shared/components/theme-toggle/theme-toggle';

@Component({
  selector: 'app-public-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, ThemeToggleComponent],
  templateUrl: './public-navbar.html',
  styleUrl: './public-navbar.scss',
})
export class PublicNavbar {
  protected readonly navItems = [
    { label: 'Urunlerimiz', route: '/products' },
    { label: 'Fiyatlandirma', route: '/pricing' },
    { label: 'Biz Kimiz', route: '/about' },
  ];

  protected readonly languageOptions = ['TR', 'EN'];
}
