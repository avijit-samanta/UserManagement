import { getSupabaseClient } from '../supabaseClient';
import { isInvalidUuidError } from './pgErrors';
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

// snake_case as Postgres/PostgREST returns it (see supabase/migrations/0001_init.sql).
interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: Role;
  name: string;
  phone: string;
  address: string;
  created_at: string;
  updated_at: string;
}

function fromRow(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    name: row.name,
    phone: row.phone,
    address: row.address,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const userRepository = {
  async list(): Promise<User[]> {
    const { data, error } = await getSupabaseClient().from('users').select('*');
    if (error) throw error;
    return (data as UserRow[]).map(fromRow);
  },

  async findById(id: string): Promise<User | undefined> {
    const { data, error } = await getSupabaseClient().from('users').select('*').eq('id', id).maybeSingle();
    if (error) {
      if (isInvalidUuidError(error)) return undefined;
      throw error;
    }
    return data ? fromRow(data as UserRow) : undefined;
  },

  async findByEmail(email: string): Promise<User | undefined> {
    // ilike for case-insensitive matching, mirroring the old JS
    // `.toLowerCase() === .toLowerCase()` comparison against the JSON file.
    const { data, error } = await getSupabaseClient().from('users').select('*').ilike('email', email).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as UserRow) : undefined;
  },

  async update(id: string, fields: UserUpdatableFields): Promise<User | undefined> {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (fields.name !== undefined) patch.name = fields.name;
    if (fields.email !== undefined) patch.email = fields.email;
    if (fields.phone !== undefined) patch.phone = fields.phone;
    if (fields.address !== undefined) patch.address = fields.address;

    const { data, error } = await getSupabaseClient()
      .from('users')
      .update(patch)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) {
      if (isInvalidUuidError(error)) return undefined;
      throw error;
    }
    return data ? fromRow(data as UserRow) : undefined;
  },

  // Only the users row. Their tickets and attachments reference it without
  // ON DELETE CASCADE, so DELETE /api/users/:id removes those first — a
  // leftover reference makes this throw a 23503 FK violation instead.
  async delete(id: string): Promise<boolean> {
    const { data, error } = await getSupabaseClient().from('users').delete().eq('id', id).select('id');
    if (error) {
      if (isInvalidUuidError(error)) return false;
      throw error;
    }
    return (data ?? []).length > 0;
  },

  async create(input: CreateUserInput): Promise<User> {
    const { data, error } = await getSupabaseClient()
      .from('users')
      .insert({
        email: input.email,
        password_hash: input.passwordHash,
        role: input.role,
        name: input.name,
        phone: input.phone,
        address: input.address,
      })
      .select('*')
      .single();
    if (error) throw error;
    return fromRow(data as UserRow);
  },
};
