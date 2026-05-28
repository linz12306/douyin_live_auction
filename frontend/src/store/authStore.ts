import { create } from 'zustand';
import type { User } from '../types/user';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isHydrating: boolean;

  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setAccessToken: (token: string) => void;
  startHydration: () => void;
  logout: () => void;
}

function loadStoredUser(): User | null {
  const raw = localStorage.getItem('auth_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    localStorage.removeItem('auth_user');
    return null;
  }
}

const storedUser = loadStoredUser();
const storedRefreshToken = localStorage.getItem('refresh_token');

export const useAuthStore = create<AuthState>((set) => ({
  user: storedRefreshToken ? storedUser : null,
  accessToken: null,
  isAuthenticated: Boolean(storedRefreshToken),
  isHydrating: false,

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('auth_user', JSON.stringify(user));
    set({ user, accessToken, isAuthenticated: true, isHydrating: false });
  },

  setAccessToken: (token) => {
    set({ accessToken: token });
  },

  startHydration: () => {
    set({ isHydrating: true });
  },

  logout: () => {
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('auth_user');
    set({ user: null, accessToken: null, isAuthenticated: false, isHydrating: false });
  },
}));
