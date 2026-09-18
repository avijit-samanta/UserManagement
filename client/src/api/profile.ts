import { api } from './client';
import type { PublicUser } from '../types';

export interface ProfileUpdateInput {
  name: string;
  email: string;
  phone: string;
  address: string;
}

export const profileApi = {
  get: () => api.get<{ user: PublicUser }>('/profile'),
  update: (data: ProfileUpdateInput) => api.put<{ user: PublicUser }>('/profile', data),
};
