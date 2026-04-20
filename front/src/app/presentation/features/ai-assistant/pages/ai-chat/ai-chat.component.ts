import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { AiAssistantRepository } from '../../../../../core/interfaces/ai-assistant.repository';
import { AiConversation, AiConversationDetail } from '../../models/ai-conversation.model';
import { AiChatMessage, SseTokenEvent, SseToolStartEvent, SseDoneEvent, SseErrorEvent } from '../../models/ai-chat-message.model';

import { AiConversationListComponent } from '../../components/ai-conversation-list/ai-conversation-list.component';
import { AiChatWindowComponent } from '../../components/ai-chat-window/ai-chat-window.component';

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [CommonModule, AiConversationListComponent, AiChatWindowComponent],
  templateUrl: './ai-chat.component.html',
  styleUrl: './ai-chat.component.scss',
})
export class AiChatComponent implements OnInit {
  private readonly repository = inject(AiAssistantRepository);
  private readonly destroyRef = inject(DestroyRef);

  // --- State Signals ---
  protected readonly conversations = signal<AiConversation[]>([]);
  protected readonly selectedConversationId = signal<number | null>(null);
  protected readonly messages = signal<AiChatMessage[]>([]);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly isAITyping = signal<boolean>(false);
  protected readonly showEmptyState = signal<boolean>(true);

  ngOnInit(): void {
    this.loadConversations();
  }

  protected loadConversations(): void {
    this.isLoading.set(true);
    this.repository.getConversations()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (list: AiConversation[]) => this.conversations.set(list),
        error: (err: unknown) => console.error('Failed to load conversations', err)
      });
  }

  protected selectConversation(id: number): void {
    if (this.selectedConversationId() === id) return;

    this.selectedConversationId.set(id);
    this.showEmptyState.set(false);
    this.isLoading.set(true);
    this.messages.set([]); // Clear current chat

    this.repository.getConversation(id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (detail: AiConversationDetail) => this.messages.set(detail.messages),
        error: (err: unknown) => console.error('Failed to load conversation details', err)
      });
  }

  protected startNewChat(): void {
    this.selectedConversationId.set(null);
    this.messages.set([]);
    this.showEmptyState.set(false); // Hide empty state to show input
  }

  protected deleteConversation(id: number): void {
    this.repository.deleteConversation(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.conversations.update(list => list.filter(c => c.id !== id));
          if (this.selectedConversationId() === id) {
            this.startNewChat();
          }
        },
        error: (err: unknown) => console.error('Failed to delete conversation', err)
      });
  }

  protected onMessageSent(content: string): void {
    if (this.isAITyping()) return;

    // 1. Add user message locally
    const userMsg: AiChatMessage = {
      id: Date.now(), // Temp ID
      role: 'User',
      content: content,
      sentAtUtc: new Date().toISOString(),
      toolsUsed: [],
      partialData: false
    };

    this.messages.update(prev => [...prev, userMsg]);
    this.isAITyping.set(true);
    this.showEmptyState.set(false);

    // 2. Start streaming
    const request = {
      conversationId: this.selectedConversationId(),
      message: content
    };

    let aiMessage: AiChatMessage | null = null;

    this.repository.streamMessage(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rawLine: string) => {
          // Process raw SSE line: "data: {...}"
          const dataJson = rawLine.replace('data: ', '').trim();
          if (!dataJson) return;

          try {
            const event = JSON.parse(dataJson);
            this.handleSseEvent(event, (updatedMsg) => {
              aiMessage = updatedMsg;
              this.updateAiMessageInList(updatedMsg);
            });
          } catch (e) {
            console.error('SSE Parse Error', e, dataJson);
          }
        },
        error: (err: unknown) => {
          console.error('Stream Error', err);
          this.isAITyping.set(false);
        },
        complete: () => {
          this.isAITyping.set(false);
          // Refresh list to update titles/last dates
          this.loadConversations();
        }
      });
  }

  private handleSseEvent(event: any, callback: (msg: AiChatMessage) => void): void {
    // Current AI message state
    let msg = this.getCurrentAiMessage();

    switch (event.type) {
      case 'token':
        const tokenEvent = event as SseTokenEvent;
        msg.content += tokenEvent.content;
        callback(msg);
        break;

      case 'tool_start':
        const toolEvent = event as SseToolStartEvent;
        if (!msg.toolsUsed.includes(toolEvent.tool)) {
          msg.toolsUsed = [...msg.toolsUsed, toolEvent.tool];
        }
        callback(msg);
        break;

      case 'done':
        const doneEvent = event as SseDoneEvent;
        msg.id = doneEvent.message_id;
        msg.partialData = doneEvent.partial_data;
        
        // Python sends "conv_4", but .NET needs the integer 4
        let convId: any = doneEvent.conversation_id;
        if (typeof convId === 'string' && convId.startsWith('conv_')) {
          convId = parseInt(convId.replace('conv_', ''), 10);
        }
        
        this.selectedConversationId.set(convId);
        callback(msg);
        break;

      case 'error':
        const errorEvent = event as SseErrorEvent;
        msg.content += `\n[Hata: ${errorEvent.message}]`;
        callback(msg);
        break;
    }
  }

  private getCurrentAiMessage(): AiChatMessage {
    const lastMsg = this.messages()[this.messages().length - 1];
    if (lastMsg && lastMsg.role === 'Assistant' && lastMsg.id < 0) {
      return { ...lastMsg };
    }

    // Create a new interim AI message
    return {
      id: -Date.now(), // Interim negative ID
      role: 'Assistant',
      content: '',
      sentAtUtc: new Date().toISOString(),
      toolsUsed: [],
      partialData: false
    };
  }

  private updateAiMessageInList(msg: AiChatMessage): void {
    this.messages.update(list => {
      const lastIdx = list.length - 1;
      if (lastIdx >= 0 && list[lastIdx].role === 'Assistant' && list[lastIdx].id < 0) {
        // Update existing interim
        const newList = [...list];
        newList[lastIdx] = msg;
        return newList;
      } else {
        // Append new
        return [...list, msg];
      }
    });
  }
}
