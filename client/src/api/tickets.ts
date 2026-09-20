import { api } from './client';
import type { Ticket } from '../types';

// Plain JSON when there's nothing to attach (keeps the request simple/small);
// FormData only when at least one file is actually being sent, since that's
// what the server's multer middleware needs to see file fields at all.
function ticketFormData(fields: Record<string, string>, files: File[]): FormData {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));
  files.forEach((file) => form.append('files', file));
  return form;
}

export const ticketsApi = {
  list: () => api.get<{ tickets: Ticket[] }>('/tickets'),
  get: (id: string) => api.get<{ ticket: Ticket }>(`/tickets/${id}`),

  create: (title: string, description: string, files: File[] = []) =>
    files.length === 0
      ? api.post<{ ticket: Ticket }>('/tickets', { title, description })
      : api.post<{ ticket: Ticket }>('/tickets', ticketFormData({ title, description }, files)),

  respond: (id: string, response: string, files: File[] = []) =>
    files.length === 0
      ? api.put<{ ticket: Ticket }>(`/tickets/${id}/respond`, { response })
      : api.put<{ ticket: Ticket }>(`/tickets/${id}/respond`, ticketFormData({ response }, files)),

  close: (id: string) => api.put<{ ticket: Ticket }>(`/tickets/${id}/close`),
  reopen: (id: string) => api.put<{ ticket: Ticket }>(`/tickets/${id}/reopen`),
};
