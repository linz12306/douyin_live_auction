import client from './client';
import type { User, UserPublic } from '../types/user';

export async function getMe(): Promise<User> {
  const { data } = await client.get('/users/me');
  return data.data;
}

export async function getUser(id: number): Promise<UserPublic> {
  const { data } = await client.get(`/users/${id}`);
  return data.data;
}

export async function updateProfile(displayName: string): Promise<void> {
  await client.put('/users/me', { display_name: displayName });
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await client.put('/users/me/password', { old_password: oldPassword, new_password: newPassword });
}

export async function uploadAvatar(file: File): Promise<string> {
  const form = new FormData();
  form.append('avatar', file);
  const { data } = await client.post('/users/me/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data.avatar_url;
}
