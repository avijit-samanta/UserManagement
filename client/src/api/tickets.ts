import { api } from './client';
import type { Ticket } from '../types';

export const ticketsApi = {
  list: () => api.get<{ tickets: Ticket[] }>('/tickets'),
  get: (id: string) => api.get<{ ticket: Ticket }>(`/tickets/${id}`),
  create: (title: string, description: string) => api.post<{ ticket: Ticket }>('/tickets', { title, description }),
  respond: (id: string, response: string) => api.put<{ ticket: Ticket }>(`/tickets/${id}/respond`, { response }),
};
