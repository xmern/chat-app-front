// src/app/services/chat.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { Conversation } from '../models/conversation.model';
import { Message } from '../models/message.model';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// Stats interfaces
export interface ConversationStats {
  conversation_id: string;
  total_messages: number;
  unread_count: number;
  participant_count: number;
  last_activity: string;
}

export interface UserChatStats {
  user_id: string;
  total_conversations: number;
  total_unread_messages: number;
  total_messages_sent: number;
  active_conversations: number;
}

export interface OnlineUsers {
  online_user_ids: string[];
  total: number;
  checked_at: string;
}

export interface UserPresence {
  user_id: string;
  is_online: boolean;
  last_seen?: string;
  device_type?: string;
}

export interface ConversationOnlineUsers {
  conversation_id: string;
  online_user_ids: string[];
  total: number;
  total_participants: number;
}

// Admin interfaces
export interface AdminConversationDetails {
  id: string;
  type: string;
  name?: string;
  participants: any[];
  total_messages: number;
  last_activity: string;
  created_at: string;
  is_deleted: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private conversationsSubject = new BehaviorSubject<Conversation[]>([]);
  public conversations$ = this.conversationsSubject.asObservable();

  private messagesSubject = new BehaviorSubject<Message[]>([]);
  public messages$ = this.messagesSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.tokenValue;
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  // ==================== Conversation Endpoints ====================

  /**
   * Get all conversations for the current user
   */
  getConversations(includeArchived: boolean = false): Observable<Conversation[]> {
    const params = new HttpParams().set('include_archived', includeArchived.toString());
    
    return this.http.get<ApiResponse<{ conversations: Conversation[], total: number }>>(
      `${environment.apiUrl}/api/v1/chat/conversations`,
      { headers: this.getHeaders(), params }
    ).pipe(
      map(response => response.data.conversations),
      tap(conversations => this.conversationsSubject.next(conversations))
    );
  }

  /**
   * Get a specific conversation by ID
   */
  getConversation(conversationId: string): Observable<Conversation> {
    return this.http.get<ApiResponse<{ conversation: Conversation }>>(
      `${environment.apiUrl}/api/v1/chat/conversations/${conversationId}`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data.conversation)
    );
  }

  /**
   * Create direct conversation
   */
  createDirectConversation(otherUserId: string): Observable<Conversation> {
    return this.http.post<ApiResponse<{ conversation: Conversation, is_new: boolean }>>(
      `${environment.apiUrl}/api/v1/chat/conversations/direct`,
      { other_user_id: otherUserId },
      { headers: this.getHeaders().set("Content-Type","application/json") }
    ).pipe(
      map(response => response.data.conversation)
    );
  }

  /**
   * Create group conversation
   */
  createGroupConversation(
    participantIds: string[], 
    name: string, 
    description?: string,
    avatarUrl?: string
  ): Observable<Conversation> {
    return this.http.post<ApiResponse<{ conversation: Conversation }>>(
      `${environment.apiUrl}/api/v1/chat/conversations/group`,
      { 
        participant_ids: participantIds,
        name: name,
        description: description,
        avatar_url: avatarUrl
      },
      { headers: this.getHeaders().set("Content-Type","application/json") }
    ).pipe(
      map(response => response.data.conversation)
    );
  }

  /**
   * Update group info (name, description, avatar)
   */
  updateGroupInfo(
    conversationId: string, 
    name?: string, 
    description?: string, 
    avatarUrl?: string
  ): Observable<Conversation> {
    const body: any = {};
    if (name !== undefined) body.name = name;
    if (description !== undefined) body.description = description;
    if (avatarUrl !== undefined) body.avatar_url = avatarUrl;

    return this.http.put<ApiResponse<{ conversation: Conversation, updated_fields: string[], updated_by: string }>>(
      `${environment.apiUrl}/api/v1/chat/conversations/${conversationId}/group-info`,
      body,
      { headers: this.getHeaders().set("Content-Type","application/json") }
    ).pipe(
      map(response => response.data.conversation)
    );
  }

  /**
   * Add participant to group
   */
  addParticipantToGroup(
    conversationId: string, 
    userId: string, 
    isAdmin: boolean = false
  ): Observable<Conversation> {
    return this.http.post<ApiResponse<{ conversation: Conversation, added_user_id: string, added_by: string }>>(
      `${environment.apiUrl}/api/v1/chat/conversations/${conversationId}/participants`,
      { user_id: userId, is_admin: isAdmin },
      { headers: this.getHeaders().set("Content-Type","application/json") }
    ).pipe(
      map(response => response.data.conversation)
    );
  }

  /**
   * Remove participant from group
   */
  removeParticipantFromGroup(conversationId: string, userId: string): Observable<Conversation> {
    return this.http.request<ApiResponse<{ conversation: Conversation, removed_user_id: string, removed_by: string }>>(
      'DELETE',
      `${environment.apiUrl}/api/v1/chat/conversations/${conversationId}/participants`,
      {
        headers: this.getHeaders().set("Content-Type","application/json"),
        body: { user_id: userId }
      }
    ).pipe(
      map(response => response.data.conversation)
    );
  }

  /**
   * Toggle mute conversation
   */
  toggleMuteConversation(conversationId: string, isMuted: boolean): Observable<any> {
    return this.http.put<ApiResponse<{ conversation_id: string, is_muted: boolean, updated_at: string }>>(
      `${environment.apiUrl}/api/v1/chat/conversations/${conversationId}/mute`,
      { is_muted: isMuted },
      { headers: this.getHeaders().set("Content-Type","application/json") }
    ).pipe(
      map(response => response.data)
    );
  }

  /**
   * Toggle archive conversation
   */
  toggleArchiveConversation(conversationId: string, isArchived: boolean): Observable<any> {
    return this.http.put<ApiResponse<{ conversation_id: string, is_archived: boolean, updated_at: string }>>(
      `${environment.apiUrl}/api/v1/chat/conversations/${conversationId}/archive`,
      { is_archived: isArchived },
      { headers: this.getHeaders().set("Content-Type","application/json") }
    ).pipe(
      map(response => response.data)
    );
  }

  // ==================== Message Endpoints ====================

  /**
   * Get messages for a conversation with pagination
   */
  getMessages(
    conversationId: string, 
    limit: number = 50, 
    beforeMessageId?: string
  ): Observable<Message[]> {
    let params = new HttpParams().set('limit', limit.toString());
    if (beforeMessageId) {
      params = params.set('before_message_id', beforeMessageId);
    }

    return this.http.get<ApiResponse<{ messages: Message[], total: number, has_more: boolean, conversation_id: string }>>(
      `${environment.apiUrl}/api/v1/chat/conversations/${conversationId}/messages`,
      { headers: this.getHeaders(), params }
    ).pipe(
      map(response => response.data.messages),
      tap(messages => this.messagesSubject.next(messages))
    );
  }

  /**
   * Send message via HTTP (with files and reply support)
   */
  sendMessageHttp(
    conversationId: string, 
    textContent?: string, 
    files?: File[], 
    replyTo?: string
  ): Observable<Message> {
    const formData = new FormData();
    formData.append('conversation_id', conversationId);
    
    if (textContent) {
      formData.append('text_content', textContent);
    }

    if (replyTo) {
      formData.append('reply_to', replyTo);
    }

    if (files && files.length > 0) {
      files.forEach(file => {
        formData.append('files', file);
      });
    }

    return this.http.post<ApiResponse<{ message: Message, conversation_updated: boolean }>>(
      `${environment.apiUrl}/api/v1/chat/messages`,
      formData,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.tokenValue}` }) }
    ).pipe(
      map(response => response.data.message)
    );
  }

  /**
   * Delete message (soft delete)
   */
  deleteMessage(messageId: string): Observable<any> {
    return this.http.delete<ApiResponse<{ message_id: string, deleted_at: string }>>(
      `${environment.apiUrl}/api/v1/chat/messages/${messageId}`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data)
    );
  }

  /**
   * Mark a specific message as read
   */
  markMessageAsRead(messageId: string): Observable<Message> {
    return this.http.put<ApiResponse<{ message: Message }>>(
      `${environment.apiUrl}/api/v1/chat/messages/${messageId}/read`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data.message)
    );
  }

  /**
   * Mark all messages in a conversation as read
   */
  markConversationAsRead(conversationId: string, upToMessageId?: string): Observable<any> {
    let params = new HttpParams();
    if (upToMessageId) {
      params = params.set('up_to_message_id', upToMessageId);
    }

    return this.http.put<ApiResponse<{ conversation_id: string, marked_as_read: number, last_read_message_id?: string }>>(
      `${environment.apiUrl}/api/v1/chat/conversations/${conversationId}/read`,
      {},
      { headers: this.getHeaders(), params }
    ).pipe(
      map(response => response.data)
    );
  }

  /**
   * Get unread message count for a conversation
   */
  getUnreadCount(conversationId: string): Observable<number> {
    return this.http.get<ApiResponse<{ conversation_id: string, unread_count: number }>>(
      `${environment.apiUrl}/api/v1/chat/conversations/${conversationId}/unread-count`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data.unread_count)
    );
  }

  // ==================== Media Endpoints ====================

  /**
   * Upload media files
   */
  uploadMedia(files: File[]): Observable<any[]> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    return this.http.post<ApiResponse<{ attachments: any[], count: number, upload_time: string }>>(
      `${environment.apiUrl}/api/v1/chat/media/upload`,
      formData,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.tokenValue}` }) }
    ).pipe(
      map(response => response.data.attachments)
    );
  }

  // ==================== Presence Endpoints ====================

  /**
   * Get list of online users
   */
  getOnlineUsers(userIds?: string[]): Observable<OnlineUsers> {
    let params = new HttpParams();
    if (userIds && userIds.length > 0) {
      userIds.forEach(id => {
        params = params.append('user_ids', id);
      });
    }

    return this.http.get<ApiResponse<OnlineUsers>>(
      `${environment.apiUrl}/api/v1/chat/presence/online`,
      { headers: this.getHeaders(), params }
    ).pipe(
      map(response => response.data)
    );
  }

  /**
   * Get presence information for a specific user
   */
  getUserPresence(userId: string): Observable<UserPresence> {
    return this.http.get<ApiResponse<UserPresence>>(
      `${environment.apiUrl}/api/v1/chat/presence/${userId}`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data)
    );
  }

  /**
   * Get online users in a conversation
   */
  getConversationOnlineUsers(conversationId: string): Observable<ConversationOnlineUsers> {
    return this.http.get<ApiResponse<ConversationOnlineUsers>>(
      `${environment.apiUrl}/api/v1/chat/presence/conversation/${conversationId}/online`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data)
    );
  }

  // ==================== Statistics Endpoints ====================

  /**
   * Get statistics for a specific conversation
   */
  getConversationStats(conversationId: string): Observable<ConversationStats> {
    return this.http.get<ApiResponse<ConversationStats>>(
      `${environment.apiUrl}/api/v1/chat/conversations/${conversationId}/stats`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data)
    );
  }

  /**
   * Get overall chat statistics for the current user
   */
  getUserChatStats(): Observable<UserChatStats> {
    return this.http.get<ApiResponse<UserChatStats>>(
      `${environment.apiUrl}/api/v1/chat/stats`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data)
    );
  }

  // ==================== Admin Endpoints ====================

  /**
   * Admin: Delete a conversation (soft delete)
   */
  adminDeleteConversation(conversationId: string): Observable<any> {
    return this.http.delete<ApiResponse<{ conversation_id: string, deleted_at: string, deleted_by: string }>>(
      `${environment.apiUrl}/api/v1/chat/admin/conversations/${conversationId}`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data)
    );
  }

  /**
   * Admin: Get detailed conversation information
   */
  adminGetConversationDetails(conversationId: string): Observable<AdminConversationDetails> {
    return this.http.get<ApiResponse<AdminConversationDetails>>(
      `${environment.apiUrl}/api/v1/chat/admin/conversations/${conversationId}/details`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data)
    );
  }

  // ==================== Local State Management ====================

  /**
   * Add message to local state
   */
  addMessage(message: Message): void {
    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next([...currentMessages, message]);
  }

  /**
   * Update message in local state
   */
  updateMessage(messageId: string, updates: Partial<Message>): void {
    const currentMessages = this.messagesSubject.value;
    const updatedMessages = currentMessages.map(msg => 
      msg._id === messageId ? { ...msg, ...updates } : msg
    );
    this.messagesSubject.next(updatedMessages);
  }

  /**
   * Remove message from local state
   */
  removeMessage(messageId: string): void {
    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next(currentMessages.filter(msg => msg._id !== messageId));
  }

  /**
   * Clear messages
   */
  clearMessages(): void {
    this.messagesSubject.next([]);
  }

  /**
   * Update conversation in local state
   */
  updateConversation(conversationId: string, updates: Partial<Conversation>): void {
    const currentConversations = this.conversationsSubject.value;
    const updatedConversations = currentConversations.map(conv =>
      conv._id === conversationId ? { ...conv, ...updates } : conv
    );
    this.conversationsSubject.next(updatedConversations);
  }
}