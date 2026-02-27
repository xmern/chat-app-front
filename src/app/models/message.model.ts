// src/app/models/message.model.ts
export interface Message {
  _id: string;
  conversation_id: string;
  sender_id: string;
  text_content?: string;
  attachments: MediaAttachment[];
  reply_to?: string;
  status: 'sent' | 'delivered' | 'read';
  read_by: string[];
  delivered_to: string[];
  created_at: string;
}

export interface MediaAttachment {
  url: string;
  media_type: string;
  mime_type: string;
  file_size: number;
  file_name?: string;
}