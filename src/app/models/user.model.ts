// src/app/models/user.model.ts
export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  phone: string;
  user_type: string;
  status: string;
  auth_provider: string;
  email_verified: boolean;
  nin_verified: string;
  nin_verified_at: string;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  remember_me?: boolean;
  device_info?: string;
}

export interface AuthData {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  user: User;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: AuthData;
}