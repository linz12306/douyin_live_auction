export type Role = 'merchant' | 'user';

export interface User {
  id: number;
  username: string;
  role: Role;
  display_name: string;
  avatar_url: string;
  balance: number;
  frozen_amount: number;
}

export interface UserPublic {
  id: number;
  username: string;
  role: Role;
  display_name: string;
  avatar_url: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
}

export interface LoginResponse extends AuthResponse {
  user: User;
}
