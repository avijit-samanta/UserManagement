export type Role = 'admin' | 'user';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  name: string;
  phone: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

export type PublicUser = Omit<User, 'passwordHash'>;

export function toPublicUser(user: User): PublicUser {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

export type TicketStatus = 'open' | 'answered' | 'closed';

export interface TicketMessage {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  createdAt: string;
  // Never persisted on the message itself — computed at response time from
  // the central `attachments` collection (see attachmentRepository) by
  // matching messageId, so a deleted file disappears from every ticket view
  // without any per-message bookkeeping.
  attachments?: PublicAttachment[];
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
  // Same story as TicketMessage.attachments: computed, not stored — these
  // are the files attached when the ticket itself was submitted (messageId
  // === null), as opposed to ones attached to a specific reply.
  attachments?: PublicAttachment[];
}

// A single uploaded file. This is the one source of truth for every file in
// the system — both the ones attached inline to a ticket/message and the
// ones uploaded directly into the File Repository. `ticketId`/`messageId`
// are null for a repository-only upload; ticketId set + messageId null for
// a file attached when the ticket was first submitted; both set for a file
// attached to a specific reply. The actual bytes live in Supabase Storage
// (see server/src/data/storageBucket.ts), not in Postgres.
export interface Attachment {
  id: string;
  /** Original filename as the browser sent it. */
  fileName: string;
  /** Object path inside the Supabase Storage bucket (see storageBucket.ts's buildStoragePath()). */
  storagePath: string;
  mimeType: string;
  size: number;
  /** Free-text subject for the File Repository's "Topic" column — defaults to the ticket's title when attached via a ticket. */
  topic: string;
  ticketId: string | null;
  messageId: string | null;
  uploadedBy: string;
  uploadedByName: string;
  uploadedByRole: Role;
  createdAt: string;
}

export type PublicAttachment = Omit<Attachment, 'storagePath'>;

// storagePath is an internal Storage-bucket detail (see
// middleware/upload.ts / routes/attachments.ts) — never returned to the
// client, same idea as toPublicUser() stripping passwordHash.
export function toPublicAttachment(attachment: Attachment): PublicAttachment {
  const { storagePath, ...publicAttachment } = attachment;
  return publicAttachment;
}
