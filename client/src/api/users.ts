import { api } from './client';
import type { PublicUser } from '../types';
import type { ProfileUpdateInput } from './profile';

export const usersApi = {
  list: () => api.get<{ users: PublicUser[] }>('/users'),
  get: (id: string) => api.get<{ user: PublicUser }>(`/users/${id}`),
  update: (id: string, data: ProfileUpdateInput) => api.put<{ user: PublicUser }>(`/users/${id}`, data),
};
