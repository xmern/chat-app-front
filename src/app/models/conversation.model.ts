// src/app/models/conversation.model.ts
export interface Conversation {
  _id: string;
  conversation_type: 'direct' | 'group';
  name?: string;
  description?: string;
  avatar_url?: string;
  participants: Participant[];
  participant_ids: string[];
  admin_ids: string[];  // Group admins
  last_message?: LastMessage;
  last_activity: string;
  total_messages: number;
  created_at: string;
  updated_at: string;
}

export interface Participant {
  user_id: string;
  unread_count: number;
  is_muted: boolean;
  is_archived: boolean;
  is_admin: boolean;  // Group admin status
  last_read_at?: string;
  joined_at?: string;
}

export interface LastMessage {
  message_id: string;
  text_preview?: string;
  sender_id: string;
  has_attachments: boolean;
  timestamp: string;
}