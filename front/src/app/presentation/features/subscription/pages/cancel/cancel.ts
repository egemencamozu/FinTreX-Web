import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cancel',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cancel.html',
  styleUrl: './cancel.scss',
})
export class Cancel {}
