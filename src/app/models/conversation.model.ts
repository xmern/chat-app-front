// src/app/models/conversation.model.ts
export interface Conversation {
  _id: string;
  type: 'direct' | 'group';
  name?: string;
  participants: Participant[];
  participant_ids: string[];
  last_message?: LastMessage;
  last_activity: string;
  total_messages: number;
}

export interface Participant {
  user_id: string;
  unread_count: number;
  is_muted: boolean;
  is_archived: boolean;
  last_read_at?: string;
}

export interface LastMessage {
  message_id: string;
  text_preview?: string;
  sender_id: string;
  has_attachments: boolean;
  timestamp: string;
}