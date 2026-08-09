import { User } from './user';

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  profilePicUrl?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateEmailRequest {
  password: string;
  newEmail: string;
}

export interface UpdateEmailResponse {
  tokens: TokenResponse;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}
