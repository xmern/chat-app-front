import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
email: string = '';
  password: string = '';
  rememberMe: boolean = false;
  loading: boolean = false;
  error: string = '';

  // Quick test users (optional)
  testUsers = [
    { email: 'ojosamuel@example.org', password: 'password123' },
    { email: 'adetokunbopeace@example.com', password: 'password123' },
    { email: 'user3@example.com', password: 'password123' }
  ];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  login(): void {
    // Validate input
    if (!this.email || !this.password) {
      this.error = 'Please enter email and password';
      return;
    }

    this.loading = true;
    this.error = '';

    this.authService.login(this.email, this.password, this.rememberMe).subscribe({
      next: (response) => {
        console.log('✅ Login successful:', response);
        this.router.navigate(['/chat']);
      },
      error: (error) => {
        console.error('❌ Login error:', error);
        this.error = error.message || 'Login failed. Please check your credentials.';
        this.loading = false;
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  quickLogin(email: string, password: string): void {
    this.email = email;
    this.password = password;
    this.login();
  }
}
