export interface CreateConversationRequest {
  economistId: string;
  title?: string;
  initialMessage?: string;
}

export interface UpdateConversationTitleRequest {
  title: string;
}
