import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicNavbar } from '../../components/public-navbar/public-navbar';

@Component({
  selector: 'app-landing-home-page',
  standalone: true,
  imports: [CommonModule, RouterLink, PublicNavbar],
  templateUrl: './landing-home.page.html',
  styleUrl: './landing-home.page.scss',
})
export class LandingHomePage {
}
