import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicNavbar } from '../../components/public-navbar/public-navbar';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink, PublicNavbar],
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class About {
}
