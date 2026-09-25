import { api, setStoredToken } from './client';
import type { PublicUser, Role } from '../types';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone: string;
  address: string;
  role: Role;
}

export interface AuthResponse {
  user: PublicUser;
  token?: string;
}

export const authApi = {
  login: async (email: string, password: string) => {
    const res = await api.post<AuthResponse>('/auth/login', { email, password });
    if (res.token) setStoredToken(res.token);
    return res;
  },
  register: async (input: RegisterInput) => {
    const res = await api.post<AuthResponse>('/auth/register', input);
    if (res.token) setStoredToken(res.token);
    return res;
  },
  logout: async () => {
    try {
      return await api.post<{ ok: true }>('/auth/logout');
    } finally {
      setStoredToken(null);
    }
  },
  me: () => api.get<{ user: PublicUser | null }>('/auth/me'),
};
