import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-test-page',
  imports: [],
  templateUrl: './test-page.html',
  styleUrl: './test-page.scss',
})
export class TestPage {
  protected readonly title = signal('Test Sayfası');
  protected readonly counter = signal(0);

  increment(): void {
    this.counter.update((v) => v + 1);
  }

  decrement(): void {
    this.counter.update((v) => v - 1);
  }
}
