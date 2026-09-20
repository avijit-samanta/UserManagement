import { api } from './client';
import type { Attachment } from '../types';

export const attachmentsApi = {
  list: () => api.get<{ attachments: Attachment[] }>('/attachments'),

  // Direct upload into the File Repository (not tied to any ticket) — the
  // "Upload More" button, available to both roles.
  upload: (topic: string, files: File[]) => {
    const form = new FormData();
    form.append('topic', topic);
    files.forEach((file) => form.append('files', file));
    return api.post<{ attachments: Attachment[] }>('/attachments', form);
  },

  remove: (id: string) => api.del<void>(`/attachments/${id}`),

  // A plain URL, not a fetch() call — used directly as an <a href> so the
  // browser handles the download (and sends the session cookie itself).
  downloadUrl: (id: string) => `/api/attachments/${id}/download`,
};
