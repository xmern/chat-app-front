// src/app/chat/chat.component.ts
import { Component, ElementRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ChatService, ConversationStats, UserChatStats, AdminConversationDetails, OnlineUsers } from '../services/chat.service';
import { SocketService } from '../services/socket.service';
import { Conversation } from '../models/conversation.model';
import { Message } from '../models/message.model';
import { User, UserType } from '../models/user.model';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-chat',
  standalone: false,
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css'
})
export class ChatComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('fileInput') fileInput!: ElementRef;

  currentUser: User | null = null;
  conversations: Conversation[] = [];
  selectedConversation: Conversation | null = null;
  messages: Message[] = [];
  messageText: string = '';
  newChatUserId: string = '';
  selectedFiles: File[] = [];
  
  showGroupModal: boolean = false;
  showGroupSettingsModal: boolean = false;
  groupName: string = '';
  groupDescription: string = '';
  selectedParticipants: string[] = [];
  newParticipantId: string = '';
  
  showMessageMenu: { [key: string]: boolean } = {};
  replyToMessage: Message | null = null;
  
  showStatsPanel: boolean = false;
  userStats: UserChatStats | null = null;
  conversationStats: ConversationStats | null = null;
  onlineUsersData: OnlineUsers | null = null;
  
  showAdminPanel: boolean = false;
  adminConversationDetails: AdminConversationDetails | null = null;
  adminSearchId: string = '';
  
  loading: boolean = false;
  typingUsers: Set<string> = new Set();
  onlineUsers: Set<string> = new Set();
  rootUrl = environment.apiUrl

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

    this.socketService.connect();
    this.setupSocketListeners();
    this.loadConversations();
    this.loadUserStats();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.socketService.disconnect();
  }

  setupSocketListeners(): void {
    const newMessageSub = this.socketService.on('new_message').subscribe(data => {
      const message = data.data?.message || data;
      if (this.selectedConversation && message.conversation_id === this.selectedConversation._id) {
        this.chatService.addMessage(message);
        setTimeout(() => this.scrollToBottom(), 100);
      }
      this.loadConversations();
    });

    const messageDeletedSub = this.socketService.on('message_deleted').subscribe(data => {
      if (this.selectedConversation && data.conversation_id === this.selectedConversation._id) {
        this.chatService.removeMessage(data.message_id);
      }
    });

    const typingSub = this.socketService.on('user_typing').subscribe(data => {
      if (data.is_typing) {
        this.typingUsers.add(data.user_id);
      } else {
        this.typingUsers.delete(data.user_id);
      }
    });

    const presenceSub = this.socketService.on('presence_updated').subscribe(data => {
      if (data.is_online) {
        this.onlineUsers.add(data.user_id);
      } else {
        this.onlineUsers.delete(data.user_id);
      }
    });

    this.subscriptions.push(newMessageSub, messageDeletedSub, typingSub, presenceSub);
  }

  loadConversations(): void {
    this.chatService.getConversations().subscribe({
      next: (conversations) => {
        this.conversations = conversations;
      },
      error: (error) => {
        console.error('Error loading conversations:', error);
      }
    });
  }

  selectConversation(conversation: Conversation): void {
    this.selectedConversation = conversation;
    this.chatService.clearMessages();
    this.replyToMessage = null;
    this.conversationStats = null;
    
    this.chatService.getMessages(conversation._id).subscribe({
      next: () => {
        setTimeout(() => this.scrollToBottom(), 100);
      },
      error: (error) => {
        console.error('Error loading messages:', error);
      }
    });

    this.chatService.markConversationAsRead(conversation._id).subscribe();
    this.loadConversationStats(conversation._id);

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
        this.newChatUserId = '';
        this.loadConversations();
        setTimeout(() => this.selectConversation(conversation), 500);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error creating conversation:', error);
        alert('Failed to create conversation');
        this.loading = false;
      }
    });
  }

  openGroupModal(): void {
    this.showGroupModal = true;
    this.groupName = '';
    this.groupDescription = '';
    this.selectedParticipants = [];
  }

  closeGroupModal(): void {
    this.showGroupModal = false;
  }

  addParticipant(): void {
    const participantId = this.newParticipantId.trim();
    if (participantId && !this.selectedParticipants.includes(participantId)) {
      this.selectedParticipants.push(participantId);
      this.newParticipantId = '';
    }
  }

  removeParticipant(participantId: string): void {
    this.selectedParticipants = this.selectedParticipants.filter(id => id !== participantId);
  }

  createGroup(): void {
    if (!this.groupName.trim()) {
      alert('Please enter a group name');
      return;
    }

    if (this.selectedParticipants.length === 0) {
      alert('Please add at least one participant');
      return;
    }

    this.loading = true;
    this.chatService.createGroupConversation(
      this.selectedParticipants,
      this.groupName,
      this.groupDescription || undefined
    ).subscribe({
      next: (conversation) => {
        this.closeGroupModal();
        this.loadConversations();
        setTimeout(() => this.selectConversation(conversation), 500);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error creating group:', error);
        alert('Failed to create group');
        this.loading = false;
      }
    });
  }

  openGroupSettings(): void {
    console.log('Attempting to open group settings for conversation:', this.selectedConversation);
    if (!this.selectedConversation || this.selectedConversation.conversation_type !== 'group') {
      return;
    }
    this.showGroupSettingsModal = true;
    console.log('Opening group settings for conversation:', this.selectedConversation);
  }

  closeGroupSettings(): void {
    this.showGroupSettingsModal = false;
    this.newParticipantId = '';
  }

  updateGroupInfo(): void {
    if (!this.selectedConversation) return;

    if (!this.isGroupAdmin(this.selectedConversation)) {
      alert('Only group admins can update group information');
      return;
    }

    const name = this.selectedConversation.name;
    const description = this.selectedConversation.description;
    
    if (!name || !name.trim()) {
      alert('Group name cannot be empty');
      return;
    }
    
    this.chatService.updateGroupInfo(
      this.selectedConversation._id,
      name,
      description
    ).subscribe({
      next: (conversation) => {
        this.selectedConversation = conversation;
        this.loadConversations();
        alert('Group info updated successfully');
      },
      error: (error) => {
        console.error('Error updating group:', error);
        alert('Failed to update group info');
      }
    });
  }

  addMemberToGroup(): void {
    if (!this.selectedConversation || !this.newParticipantId.trim()) {
      alert('Please enter a user ID');
      return;
    }

    if (!this.isGroupAdmin(this.selectedConversation)) {
      alert('Only group admins can add participants');
      return;
    }

    const participantId = this.newParticipantId.trim();

    if (this.selectedConversation.participant_ids.includes(participantId)) {
      alert('This user is already a member of the group');
      this.newParticipantId = '';
      return;
    }

    this.chatService.addParticipantToGroup(
      this.selectedConversation._id,
      participantId
    ).subscribe({
      next: (conversation) => {
        this.selectedConversation = conversation;
        this.newParticipantId = '';
        this.loadConversations();
        alert('Member added successfully');
      },
      error: (error) => {
        console.error('Error adding participant:', error);
        alert('Failed to add participant');
      }
    });
  }

  removeMemberFromGroup(userId: string): void {
    if (!this.selectedConversation) return;

    const isRemovingSelf = userId === this.currentUser?.id;
    
    if (!isRemovingSelf && !this.isGroupAdmin(this.selectedConversation)) {
      alert('Only group admins can remove other participants');
      return;
    }

    const confirmMsg = isRemovingSelf ? 
      'Are you sure you want to leave this group?' : 
      'Are you sure you want to remove this member?';

    if (!confirm(confirmMsg)) {
      return;
    }

    this.chatService.removeParticipantFromGroup(
      this.selectedConversation._id,
      userId
    ).subscribe({
      next: (conversation) => {
        if (isRemovingSelf) {
          this.selectedConversation = null;
          this.closeGroupSettings();
        } else {
          this.selectedConversation = conversation;
        }
        this.loadConversations();
        alert(isRemovingSelf ? 'Left group successfully' : 'Member removed successfully');
      },
      error: (error) => {
        console.error('Error removing participant:', error);
        alert('Failed to remove participant');
      }
    });
  }

  sendMessage(): void {
    if (!this.selectedConversation) return;
    
    const text = this.messageText.trim();
    const files = this.selectedFiles;

    if (!text && files.length === 0) return;

    if (files.length > 0 || this.replyToMessage) {
      this.chatService.sendMessageHttp(
        this.selectedConversation._id,
        text || undefined,
        files,
        this.replyToMessage?._id
      ).subscribe({
        next: () => {
          this.messageText = '';
          this.selectedFiles = [];
          this.replyToMessage = null;
          if (this.fileInput) {
            this.fileInput.nativeElement.value = '';
          }
        },
        error: (error) => {
          console.error('Error sending message:', error);
        }
      });
    } else {
      this.socketService.emit('send_message', {
        conversation_id: this.selectedConversation._id,
        text_content: text
      });
      this.messageText = '';
      this.replyToMessage = null;
    }
  }

  deleteMessage(message: Message): void {
    if (!this.isMyMessage(message)) {
      alert('You can only delete your own messages');
      return;
    }

    if (!confirm('Are you sure you want to delete this message?')) {
      return;
    }

    this.chatService.deleteMessage(message._id).subscribe({
      next: () => {
        this.chatService.removeMessage(message._id);
        this.hideMessageMenu(message._id);
      },
      error: (error) => {
        console.error('Error deleting message:', error);
        alert('Failed to delete message');
      }
    });
  }

  replyTo(message: Message): void {
    this.replyToMessage = message;
    this.hideMessageMenu(message._id);
  }

  cancelReply(): void {
    this.replyToMessage = null;
  }

  toggleMessageMenu(messageId: string): void {
    Object.keys(this.showMessageMenu).forEach(key => {
      if (key !== messageId) {
        this.showMessageMenu[key] = false;
      }
    });
    this.showMessageMenu[messageId] = !this.showMessageMenu[messageId];
  }

  hideMessageMenu(messageId: string): void {
    this.showMessageMenu[messageId] = false;
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

  toggleStatsPanel(): void {
    this.showStatsPanel = !this.showStatsPanel;
    if (this.showStatsPanel) {
      this.loadUserStats();
      if (this.selectedConversation) {
        this.loadConversationStats(this.selectedConversation._id);
      }
    }
  }

  loadUserStats(): void {
    this.chatService.getUserChatStats().subscribe({
      next: (stats) => {
        this.userStats = stats;
      },
      error: (error) => {
        console.error('Error loading user stats:', error);
      }
    });
  }

  loadConversationStats(conversationId: string): void {
    this.chatService.getConversationStats(conversationId).subscribe({
      next: (stats) => {
        this.conversationStats = stats;
      },
      error: (error) => {
        console.error('Error loading conversation stats:', error);
      }
    });
  }

  loadOnlineUsers(): void {
    this.chatService.getOnlineUsers().subscribe({
      next: (data) => {
        this.onlineUsersData = data;
      },
      error: (error) => {
        console.error('Error loading online users:', error);
      }
    });
  }

  toggleAdminPanel(): void {
    this.showAdminPanel = !this.showAdminPanel;
    if (this.showAdminPanel) {
      this.loadOnlineUsers();
    }
  }

  adminSearchConversation(): void {
    if (!this.adminSearchId.trim()) {
      alert('Please enter a conversation ID');
      return;
    }

    this.chatService.adminGetConversationDetails(this.adminSearchId).subscribe({
      next: (details) => {
        this.adminConversationDetails = details;
      },
      error: (error) => {
        console.error('Error loading admin details:', error);
        alert('Failed to load conversation details');
      }
    });
  }

  adminDeleteConversation(conversationId: string): void {
    if (!confirm('Are you sure you want to delete this conversation?')) {
      return;
    }

    this.chatService.adminDeleteConversation(conversationId).subscribe({
      next: () => {
        alert('Conversation deleted successfully');
        this.adminConversationDetails = null;
        this.adminSearchId = '';
        this.loadConversations();
      },
      error: (error) => {
        console.error('Error deleting conversation:', error);
        alert('Failed to delete conversation');
      }
    });
  }

  toggleMuteConversation(conversation: Conversation): void {
    const isMuted = this.isConversationMuted(conversation);
    
    this.chatService.toggleMuteConversation(conversation._id, !isMuted).subscribe({
      next: () => {
        this.loadConversations();
      },
      error: (error) => {
        console.error('Error toggling mute:', error);
      }
    });
  }

  toggleArchiveConversation(conversation: Conversation): void {
    const isArchived = this.isConversationArchived(conversation);
    
    this.chatService.toggleArchiveConversation(conversation._id, !isArchived).subscribe({
      next: () => {
        this.loadConversations();
      },
      error: (error) => {
        console.error('Error toggling archive:', error);
      }
    });
  }

  isMyMessage(message: Message): boolean {
    return message.sender_id === this.currentUser?.id;
  }

  isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  isGroupAdmin(conversation: Conversation): boolean {
    console.log('Checking if user is group admin for conversation:', conversation);
    if (conversation.conversation_type !== 'group') return false;
    const participant = conversation.admin_ids.find(adminId => adminId === this.currentUser?.id);
    console.log('Checking if user is group admin:', participant);
    return participant !== undefined;
  }

  isParticipantAdmin(conversation: Conversation, userId: string): boolean {
    const participant = conversation.participants.find(p => p.user_id === userId);
    return participant?.is_admin || false;
  }

  canRemoveMember(conversation: Conversation, userId: string): boolean {
    if (userId === this.currentUser?.id) return true;
    return this.isGroupAdmin(conversation);
  }

  isConversationMuted(conversation: Conversation): boolean {
    const participant = conversation.participants.find(p => p.user_id === this.currentUser?.id);
    return participant?.is_muted || false;
  }

  isConversationArchived(conversation: Conversation): boolean {
    const participant = conversation.participants.find(p => p.user_id === this.currentUser?.id);
    return participant?.is_archived || false;
  }

  isAdmin(): boolean {
    return this.currentUser?.user_type === UserType.ADMIN;
  }

  getOtherUserId(conversation: Conversation): string {
    return conversation.participant_ids.find(id => id !== this.currentUser?.id) || '';
  }

  getConversationName(conversation: Conversation): string {
    if (conversation.conversation_type === 'group') {
      return conversation.name || 'Unnamed Group';
    }
    return this.getOtherUserId(conversation) || 'Unknown';
  }

  getUnreadCount(conversation: Conversation): number {
    const participant = conversation.participants.find(p => p.user_id === this.currentUser?.id);
    return participant?.unread_count || 0;
  }

  getFirstChar(text: string | undefined | null): string {
    if (!text || text.length === 0) return 'G';
    return text.charAt(0).toUpperCase();
  }

  getOtherUserIdFirstChar(conversation: Conversation): string {
    if (conversation.conversation_type === 'group') {
      return this.getFirstChar(conversation.name || 'G');
    }
    const userId = this.getOtherUserId(conversation);
    return this.getFirstChar(userId);
  }

  getRepliedMessage(messageId: string): Message | undefined {
    return this.messages.find(msg => msg._id === messageId);
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  scrollToBottom(): void {
    if (this.messagesContainer) {
      this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
    }
  }

  logout(): void {
    this.authService.logout();
    this.socketService.disconnect();
    this.router.navigate(['/login']);
  }
}