// src/app/services/chat.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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

  // Get all conversations
  getConversations(): Observable<Conversation[]> {
    return this.http.get<ApiResponse<{ conversations: Conversation[], total: number }>>(
      `${environment.apiUrl}/api/v1/chat/conversations`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data.conversations),
      tap(conversations => this.conversationsSubject.next(conversations))
    );
  }

  // Create direct conversation
  createDirectConversation(otherUserId: string): Observable<Conversation> {
    return this.http.post<ApiResponse<{ conversation: Conversation }>>(
      `${environment.apiUrl}/api/v1/chat/conversations/direct`,
      { other_user_id: otherUserId },
      { headers: this.getHeaders().set("Content-Type","application/json") }
    ).pipe(
      map(response => response.data.conversation)
    );
  }

  // Get messages for a conversation
  getMessages(conversationId: string, limit: number = 50): Observable<Message[]> {
    return this.http.get<ApiResponse<{ messages: Message[], total: number, has_more: boolean }>>(
      `${environment.apiUrl}/api/v1/chat/conversations/${conversationId}/messages?limit=${limit}`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data.messages),
      tap(messages => this.messagesSubject.next(messages))
    );
  }

  // Send message via HTTP (with files)
  sendMessageHttp(conversationId: string, textContent?: string, files?: File[]): Observable<Message> {
    const formData = new FormData();
    formData.append('conversation_id', conversationId);
    
    if (textContent) {
      formData.append('text_content', textContent);
    }

    if (files && files.length > 0) {
      files.forEach(file => {
        formData.append('files', file);
      });
    }

    return this.http.post<ApiResponse<{ message: Message }>>(
      `${environment.apiUrl}/api/v1/chat/messages`,
      formData,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.tokenValue}` }) }
    ).pipe(
      map(response => response.data.message)
    );
  }

  // Mark conversation as read
  markConversationAsRead(conversationId: string): Observable<any> {
    return this.http.put<ApiResponse<any>>(
      `${environment.apiUrl}/api/v1/chat/conversations/${conversationId}/read`,
      {},
      { headers: this.getHeaders() }
    );
  }

  // Add message to local state
  addMessage(message: Message): void {
    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next([...currentMessages, message]);
  }

  // Clear messages
  clearMessages(): void {
    this.messagesSubject.next([]);
  }
}