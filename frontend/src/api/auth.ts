import axios from 'axios';
import client from './client';
import type { AuthResponse, LoginResponse } from '../types/user';

export async function register(
  username: string, password: string, role: string, displayName: string,
): Promise<LoginResponse> {
  const { data } = await client.post('/auth/register', {
    username, password, role, display_name: displayName,
  });
  return data.data;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const { data } = await client.post('/auth/login', { username, password });
  return data.data;
}

export async function refreshTokenFn(refreshToken: string): Promise<AuthResponse> {
  const { data } = await axios.post('/api/v1/auth/refresh', { refresh_token: refreshToken });
  return data.data;
}

export async function logout(refreshToken: string): Promise<void> {
  await client.post('/auth/logout', { refresh_token: refreshToken });
}
