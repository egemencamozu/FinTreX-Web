import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-public-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
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
