import {
  Component,
  input,
  output,
  signal,
  ElementRef,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-ai-chat-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-chat-input.component.html',
  styleUrl: './ai-chat-input.component.scss',
})
export class AiChatInputComponent {
  readonly disabled = input<boolean>(false);
  readonly messageSent = output<string>();

  protected readonly text = signal('');
  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  protected send(): void {
    const value = this.text().trim();
    if (!value || this.disabled()) return;

    this.messageSent.emit(value);
    this.text.set('');
    this.textarea()?.nativeElement.focus();
  }
}
