import { Component, EventEmitter, Input, Output, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EconomistRepository } from '../../../../../core/interfaces/economist.repository';
import { ChatRepository } from '../../../../../core/interfaces/chat.repository';
import { EconomistClient } from '../../../../../core/models/economist.model';
import { CreateConversationRequest } from '../../models';

@Component({
  selector: 'app-new-chat-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './new-chat-dialog.html',
  styleUrl: './new-chat-dialog.scss',
})
export class NewChatDialogComponent implements OnInit {
  private economistRepo = inject(EconomistRepository);
  private chatRepo = inject(ChatRepository);

  @Output() close = new EventEmitter<void>();
  @Output() conversationCreated = new EventEmitter<any>();

  economists = signal<EconomistClient[]>([]);
  isLoading = signal(false);
  isSubmitting = signal(false);

  form = {
    economistId: '',
    title: '',
    initialMessage: '',
  };

  ngOnInit() {
    this.loadEconomists();
  }

  private loadEconomists() {
    this.isLoading.set(true);
    this.economistRepo.getMyEconomists().subscribe({
      next: (data) => {
        this.economists.set(data.filter(a => a.isActive));
        if (this.economists().length > 0) {
          this.form.economistId = this.economists()[0].economistId;
        }
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  onSubmit() {
    if (!this.form.economistId) return;

    this.isSubmitting.set(true);
    const request: CreateConversationRequest = {
      economistId: this.form.economistId,
      title: this.form.title.trim() || undefined,
      initialMessage: this.form.initialMessage.trim() || undefined,
    };

    this.chatRepo.createConversation(request).subscribe({
      next: (conv) => {
        this.isSubmitting.set(false);
        this.conversationCreated.emit(conv);
        this.close.emit();
      },
      error: () => this.isSubmitting.set(false),
    });
  }

  onCancel() {
    this.close.emit();
  }
}
