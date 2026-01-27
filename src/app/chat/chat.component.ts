import { Component, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ChatService } from '../services/chat.service';
import { SocketService } from '../services/socket.service';
import { Conversation } from '../models/conversation.model';
import { Message } from '../models/message.model';
import { User } from '../models/user.model';

@Component({
  selector: 'app-chat',
  standalone: false,
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css'
})
export class ChatComponent {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('fileInput') fileInput!: ElementRef;

  currentUser: User | null = null;
  conversations: Conversation[] = [];
  selectedConversation: Conversation | null = null;
  messages: Message[] = [];
  messageText: string = '';
  newChatUserId: string = '';
  selectedFiles: File[] = [];
  
  loading: boolean = false;
  typingUsers: Set<string> = new Set();
  onlineUsers: Set<string> = new Set();

  private subscriptions: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private chatService: ChatService,
    private socketService: SocketService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.currentUserValue;
    
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    // Connect to socket
    this.socketService.connect();

    // Listen to socket events
    this.setupSocketListeners();

    // Load conversations
    this.loadConversations();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.socketService.disconnect();
  }

  setupSocketListeners(): void {
    // New message event
    const newMessageSub = this.socketService.on('new_message').subscribe(data => {
      console.log('📨 New message received:', data);
      const message = data.data?.message || data;
      
      if (this.selectedConversation && message.conversation_id === this.selectedConversation._id) {
        this.chatService.addMessage(message);
        setTimeout(() => this.scrollToBottom(), 100);
      }
      
      // Refresh conversations to update last message
      this.loadConversations();
    });

    // Typing indicator
    const typingSub = this.socketService.on('user_typing').subscribe(data => {
      console.log('⌨️ User typing:', data);
      if (data.is_typing) {
        this.typingUsers.add(data.user_id);
      } else {
        this.typingUsers.delete(data.user_id);
      }
    });

    // Presence updates
    const presenceSub = this.socketService.on('presence_updated').subscribe(data => {
      console.log('👤 Presence updated:', data);
      if (data.is_online) {
        this.onlineUsers.add(data.user_id);
      } else {
        this.onlineUsers.delete(data.user_id);
      }
    });

    // Authenticated event
    const authSub = this.socketService.on('authenticated').subscribe(data => {
      console.log('✅ Authenticated:', data);
    });

    this.subscriptions.push(newMessageSub, typingSub, presenceSub, authSub);
  }

  loadConversations(): void {
    this.chatService.getConversations().subscribe({
      next: (conversations) => {
        this.conversations = conversations;
        console.log('Conversations loaded:', conversations);
      },
      error: (error) => {
        console.error('Error loading conversations:', error);
      }
    });
  }

  selectConversation(conversation: Conversation): void {
    this.selectedConversation = conversation;
    this.chatService.clearMessages();
    
    // Load messages
    this.chatService.getMessages(conversation._id).subscribe({
      next: (messages) => {
        console.log('Messages loaded:', messages);
        setTimeout(() => this.scrollToBottom(), 100);
      },
      error: (error) => {
        console.error('Error loading messages:', error);
      }
    });

    // Mark as read
    this.chatService.markConversationAsRead(conversation._id).subscribe();

    // Subscribe to messages
    const messagesSub = this.chatService.messages$.subscribe(messages => {
      this.messages = messages;
    });
    this.subscriptions.push(messagesSub);
  }

  createDirectChat(): void {
    if (!this.newChatUserId.trim()) {
      alert('Please enter a user ID');
      return;
    }

    this.loading = true;
    this.chatService.createDirectConversation(this.newChatUserId).subscribe({
      next: (conversation) => {
        console.log('Conversation created:', conversation);
        this.newChatUserId = '';
        this.loadConversations();
        setTimeout(() => this.selectConversation(conversation), 500);
      },
      error: (error) => {
        console.error('Error creating conversation:', error);
        alert('Failed to create conversation');
        this.loading = false
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  sendMessage(): void {
    if (!this.selectedConversation){ console.log("no convo");return;}
    
    const text = this.messageText.trim();
    const files = this.selectedFiles;

    if (!text && files.length === 0) return;
    console.log("sending ...")

    if (files.length > 0) {
      // Send via HTTP with files
      this.chatService.sendMessageHttp(
        this.selectedConversation._id,
        text || undefined,
        files
      ).subscribe({
        next: (message) => {
          console.log('Message sent via HTTP:', message);
          this.messageText = '';
          this.selectedFiles = [];
          if (this.fileInput) {
            this.fileInput.nativeElement.value = '';
          }
        },
        error: (error) => {
          console.error('Error sending message:', error);
        }
      });
    } else {
      // Send via Socket.IO for text-only messages
      this.socketService.emit('send_message', {
        conversation_id: this.selectedConversation._id,
        text_content: text
      });
      this.messageText = '';
    }
  }

  onFileSelected(event: any): void {
    const files: FileList = event.target.files;
    this.selectedFiles = Array.from(files);
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
  }

  onTyping(): void {
    if (this.selectedConversation) {
      this.socketService.emit('typing_start', {
        conversation_id: this.selectedConversation._id,
        is_typing: true
      });
    }
  }

  onStopTyping(): void {
    if (this.selectedConversation) {
      this.socketService.emit('typing_stop', {
        conversation_id: this.selectedConversation._id,
        is_typing: false
      });
    }
  }

  isMyMessage(message: Message): boolean {
    return message.sender_id === this.currentUser?.id;
  }

  isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  getOtherUserId(conversation: Conversation): string {
    return conversation.participant_ids.find(id => id !== this.currentUser?.id) || '';
  }

  scrollToBottom(): void {
    if (this.messagesContainer) {
      this.messagesContainer.nativeElement.scrollTop =
        this.messagesContainer.nativeElement.scrollHeight;
    }
  }

  logout(): void {
    this.authService.logout();
    this.socketService.disconnect();
    this.router.navigate(['/login']);
  }
  // Add these methods to your chat.component.ts

getUnreadCount(conversation: Conversation): number {
  const participant = conversation.participants.find(
    p => p.user_id === this.currentUser?.id
  );
  return participant?.unread_count || 0;
}

formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
// Add these helper methods to your ChatComponent class

getFirstChar(text: string | undefined | null): string {
  if (!text || text.length === 0) return 'G';
  return text.charAt(0).toUpperCase();
}

getOtherUserIdFirstChar(conversation: Conversation): string {
  const userId = this.getOtherUserId(conversation);
  return this.getFirstChar(userId);
}
}
