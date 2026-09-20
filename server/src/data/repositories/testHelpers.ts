import { getSupabaseClient } from '../supabaseClient';

// Empties every table in the `test` schema (see src/test-setup.ts), in
// FK-safe order, between test cases — the real-Postgres equivalent of the
// old writeDb({ users: [], tickets: [] }) reset. PostgREST requires DELETE
// to carry at least one filter, so `.not('id', 'is', null)` (every row's id
// is a non-null primary key) acts as an always-true "delete everything".
export async function truncateTestTables(): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.from('attachments').delete().not('id', 'is', null);
  await supabase.from('ticket_messages').delete().not('id', 'is', null);
  await supabase.from('tickets').delete().not('id', 'is', null);
  await supabase.from('users').delete().not('id', 'is', null);
}
