import { api } from './client';
import type { PublicUser } from '../types';

export const authApi = {
  login: (email: string, password: string) => api.post<{ user: PublicUser }>('/auth/login', { email, password }),
  logout: () => api.post<{ ok: true }>('/auth/logout'),
  me: () => api.get<{ user: PublicUser }>('/auth/me'),
};
