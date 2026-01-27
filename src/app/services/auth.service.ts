// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { User, AuthResponse, LoginRequest } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;
  private tokenSubject: BehaviorSubject<string | null>;
  public token: Observable<string | null>;

  constructor(private http: HttpClient) {
    this.currentUserSubject = new BehaviorSubject<User | null>(
      JSON.parse(localStorage.getItem('currentUser') || 'null')
    );
    this.currentUser = this.currentUserSubject.asObservable();

    this.tokenSubject = new BehaviorSubject<string | null>(
      localStorage.getItem('token')
    );
    this.token = this.tokenSubject.asObservable();
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public get tokenValue(): string | null {
    return this.tokenSubject.value;
  }

  login(email: string, password: string, rememberMe: boolean = false): Observable<AuthResponse> {
    const loginRequest: LoginRequest = {
      email: email,
      password: password,
      remember_me: rememberMe,
      device_info: this.getDeviceInfo()
    };

    return this.http.post<AuthResponse>(
      `${environment.apiUrl}/api/v1/auth/login`, // Update this to your actual login endpoint
      loginRequest
    ).pipe(
      map(response => {
        if (response.success && response.data.access_token) {
          // Store user and token
          localStorage.setItem('currentUser', JSON.stringify(response.data.user));
          localStorage.setItem('token', response.data.access_token);
          
          // Store refresh token if remember_me is true
          if (rememberMe && response.data.refresh_token) {
            localStorage.setItem('refresh_token', response.data.refresh_token);
          }

          // Update subjects
          this.currentUserSubject.next(response.data.user);
          this.tokenSubject.next(response.data.access_token);

          console.log('✅ Login successful:', response.data.user);
        }
        return response;
      }),
      catchError(this.handleError)
    );
  }

  logout(): void {
    // Clear local storage
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    
    // Update subjects
    this.currentUserSubject.next(null);
    this.tokenSubject.next(null);
    
    console.log('👋 Logged out');
  }

  isAuthenticated(): boolean {
    return !!this.tokenValue;
  }

  refreshToken(): Observable<AuthResponse> {
    const refreshToken = localStorage.getItem('refresh_token');
    
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http.post<AuthResponse>(
      `${environment.apiUrl}/api/v1/auth/refresh`, // Update to your refresh endpoint
      { refresh_token: refreshToken }
    ).pipe(
      map(response => {
        if (response.success && response.data.access_token) {
          localStorage.setItem('token', response.data.access_token);
          this.tokenSubject.next(response.data.access_token);
        }
        return response;
      }),
      catchError(this.handleError)
    );
  }

  private getDeviceInfo(): string {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    return `${platform} - ${userAgent}`;
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.error?.detail) {
        errorMessage = error.error.detail;
      } else {
        errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      }
    }
    
    console.error('❌ Auth Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}