import { readDb, writeDb } from '../db';
import type { User } from '../../models/types';

export interface UserUpdatableFields {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
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
};
