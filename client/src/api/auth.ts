import { api } from './client';
import type { PublicUser, Role } from '../types';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone: string;
  address: string;
  role: Role;
}

export const authApi = {
  login: (email: string, password: string) => api.post<{ user: PublicUser }>('/auth/login', { email, password }),
  register: (input: RegisterInput) => api.post<{ user: PublicUser }>('/auth/register', input),
  logout: () => api.post<{ ok: true }>('/auth/logout'),
  me: () => api.get<{ user: PublicUser }>('/auth/me'),
};
