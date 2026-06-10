import { create } from 'zustand';
import { User, AuthResponse } from '../types';
import api from '../utils/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,

  loadFromStorage: () => {
    const token = localStorage.getItem('skribbl_token');
    const raw = localStorage.getItem('skribbl_user');
    if (token && raw) {
      try {
        const user: User = JSON.parse(raw);
        set({ user, token });
      } catch {
        localStorage.removeItem('skribbl_token');
        localStorage.removeItem('skribbl_user');
      }
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
      localStorage.setItem('skribbl_token', data.token);
      localStorage.setItem('skribbl_user', JSON.stringify(data.user));
      set({ user: data.user, token: data.token, isLoading: false });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Login failed';
      set({ error: msg, isLoading: false });
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post<AuthResponse>('/auth/register', { name, email, password });
      localStorage.setItem('skribbl_token', data.token);
      localStorage.setItem('skribbl_user', JSON.stringify(data.user));
      set({ user: data.user, token: data.token, isLoading: false });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Registration failed';
      set({ error: msg, isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('skribbl_token');
    localStorage.removeItem('skribbl_user');
    set({ user: null, token: null, error: null });
  },

  clearError: () => set({ error: null }),
}));
