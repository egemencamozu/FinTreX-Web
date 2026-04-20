import { Component, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface MoverListItem {
  avatarUrl?: string;
  avatarFallback: string;
  avatarColor?: string;
  label: string;
  value: string;
  change: number;
}

@Component({
  selector: 'app-mover-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mover-list.component.html',
  styleUrl: './mover-list.component.scss',
})
export class MoverListComponent {
  readonly title       = input<string>('');
  readonly items       = input.required<MoverListItem[]>();
  readonly moreLabel   = input<string>('');
  readonly moreLink    = input<string>('');
  readonly centerValue = input<boolean>(false);

  readonly failedUrls = signal(new Set<string>());

  onImgError(url: string): void {
    this.failedUrls.update(set => new Set(set).add(url));
  }
}
