import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicNavbar } from '../../components/public-navbar/public-navbar';

@Component({
  selector: 'app-trial',
  standalone: true,
  imports: [RouterLink, PublicNavbar],
  templateUrl: './trial.html',
  styleUrl: './trial.scss',
})
export class Trial {}
