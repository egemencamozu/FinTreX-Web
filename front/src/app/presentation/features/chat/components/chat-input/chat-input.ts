import { Component, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-input.html',
  styleUrl: './chat-input.scss',
})
export class ChatInputComponent {
  @Output() messageSent = new EventEmitter<string>();
  @Output() typing = new EventEmitter<void>();

  messageText = signal('');

  onSend() {
    const text = this.messageText().trim();
    if (text) {
      this.messageSent.emit(text);
      this.messageText.set('');
    }
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSend();
    } else {
      this.typing.emit();
    }
  }
}
