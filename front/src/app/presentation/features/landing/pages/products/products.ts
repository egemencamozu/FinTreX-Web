import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicNavbar } from '../../components/public-navbar/public-navbar';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [RouterLink, PublicNavbar],
  templateUrl: './products.html',
  styleUrl: './products.scss',
})
export class Products {}
