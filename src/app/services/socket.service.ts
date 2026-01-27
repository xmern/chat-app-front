// src/app/services/socket.service.ts
import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket | null = null;

  constructor(private authService: AuthService) {}

  connect(): void {
    const token = this.authService.tokenValue;
    
    if (!token) {
      console.error('No token available for socket connection');
      return;
    }

    this.socket = io(environment.socketUrl, {
      path: environment.socketPath,
      auth: {
        token: token,
        device_type: 'web',
        device_id: `browser_${Date.now()}`
      }
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
    });

    this.socket.on('error', (error: any) => {
      console.error('❌ Socket error:', error);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Listen to events
  on(eventName: string): Observable<any> {
    return new Observable(observer => {
      if (!this.socket) {
        observer.error('Socket not connected');
        return;
      }

      this.socket.on(eventName, (data: any) => {
        observer.next(data);
      });

      return () => {
        if (this.socket) {
          this.socket.off(eventName);
        }
      };
    });
  }

  // Emit events
  emit(eventName: string, data: any): void {
    if (this.socket) {
      this.socket.emit(eventName, data);
    } else {
      console.error('Socket not connected');
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}