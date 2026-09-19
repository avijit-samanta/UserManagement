import { readDb, writeDb } from '../db';
import { generateUuid } from '../../utils/id';
import type { Role, User } from '../../models/types';

export interface UserUpdatableFields {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  role: Role;
  name: string;
  phone: string;
  address: string;
}

export const userRepository = {
  async list(): Promise<User[]> {
    const db = await readDb();
    return db.users;
  },

  async findById(id: string): Promise<User | undefined> {
    const db = await readDb();
    return db.users.find((u) => u.id === id);
  },

  async findByEmail(email: string): Promise<User | undefined> {
    const db = await readDb();
    return db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  },

  async update(id: string, fields: UserUpdatableFields): Promise<User | undefined> {
    const db = await readDb();
    const user = db.users.find((u) => u.id === id);
    if (!user) return undefined;

    if (fields.name !== undefined) user.name = fields.name;
    if (fields.email !== undefined) user.email = fields.email;
    if (fields.phone !== undefined) user.phone = fields.phone;
    if (fields.address !== undefined) user.address = fields.address;
    user.updatedAt = new Date().toISOString();

    await writeDb(db);
    return user;
  },

  async create(input: CreateUserInput): Promise<User> {
    const db = await readDb();
    const now = new Date().toISOString();
    const user: User = {
      id: generateUuid(),
      email: input.email,
      passwordHash: input.passwordHash,
      role: input.role,
      name: input.name,
      phone: input.phone,
      address: input.address,
      createdAt: now,
      updatedAt: now,
    };
    db.users.push(user);
    await writeDb(db);
    return user;
  },
};
