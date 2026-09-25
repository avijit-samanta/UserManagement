import { api } from './client';
import type { PublicUser, Role } from '../types';
import type { ProfileUpdateInput } from './profile';

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  phone: string;
  address: string;
  role: Role;
}

export const usersApi = {
  list: () => api.get<{ users: PublicUser[] }>('/users'),
  get: (id: string) => api.get<{ user: PublicUser }>(`/users/${id}`),
  create: (input: CreateUserInput) => api.post<{ user: PublicUser }>('/users', input),
  update: (id: string, data: ProfileUpdateInput) => api.put<{ user: PublicUser }>(`/users/${id}`, data),
  remove: (id: string) => api.del<void>(`/users/${id}`),
};
