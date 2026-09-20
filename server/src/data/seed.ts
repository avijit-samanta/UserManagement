import { getSupabaseClient } from './supabaseClient';
import { hashPassword } from '../utils/password';

// Seeds the two demo accounts the first time the app runs against an empty
// `users` table — mirrors the old data/db.json first-run behavior, just
// against Postgres instead. Safe to call on every startup: it's a no-op
// once any user exists.
export async function seedIfNeeded(): Promise<void> {
  const supabase = getSupabaseClient();

  const { count, error: countError } = await supabase.from('users').select('*', { count: 'exact', head: true });
  if (countError) throw countError;
  if (count && count > 0) return;

  const { error } = await supabase.from('users').insert([
    {
      email: 'admin@example.com',
      password_hash: hashPassword('Admin@123'),
      role: 'admin',
      name: 'Alex Administrator',
      phone: '+1 (555) 010-0001',
      address: '100 Admin Plaza, Suite 1, Metropolis',
    },
    {
      email: 'user@example.com',
      password_hash: hashPassword('User@123'),
      role: 'user',
      name: 'Jamie User',
      phone: '+1 (555) 010-0002',
      address: '200 Resident Ave, Apt 4B, Metropolis',
    },
  ]);
  if (error) throw error;
}
