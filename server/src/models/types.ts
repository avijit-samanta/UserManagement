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

export type TicketStatus = 'open' | 'answered';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  submittedBy: string;
  submittedByName: string;
  status: TicketStatus;
  adminResponse: string | null;
  respondedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DbShape {
  users: User[];
  tickets: Ticket[];
}
