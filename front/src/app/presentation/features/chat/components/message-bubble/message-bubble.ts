import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatMessage } from '../../models';

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './message-bubble.html',
  styleUrl: './message-bubble.scss',
})
export class MessageBubbleComponent {
  @Input() message!: ChatMessage;
  @Input() isMe: boolean = false;
  @Output() editRequested = new EventEmitter<{id: number, content: string}>();
  @Output() deleteRequested = new EventEmitter<number>();

  isEditing = signal(false);
  editContent = signal('');

  startEdit() {
    this.editContent.set(this.message.content);
    this.isEditing.set(true);
  }

  saveEdit() {
    const finalContent = this.editContent().trim();
    if (finalContent && finalContent !== this.message.content) {
      this.editRequested.emit({ id: this.message.id, content: finalContent });
    }
    this.isEditing.set(false);
  }

  cancelEdit() {
    this.isEditing.set(false);
  }

  deleteMessage() {
    if (confirm('Bu mesajı silmek istediğinizden emin misiniz?')) {
      this.deleteRequested.emit(this.message.id);
    }
  }
}
