export type Role = 'admin' | 'user';

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
  name: string;
  phone: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

export type TicketStatus = 'open' | 'answered' | 'closed';

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  topic: string;
  ticketId: string | null;
  messageId: string | null;
  uploadedBy: string;
  uploadedByName: string;
  uploadedByRole: Role;
  createdAt: string;
}

export interface TicketMessage {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  createdAt: string;
  attachments?: Attachment[];
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  submittedBy: string;
  submittedByName: string;
  status: TicketStatus;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
}
