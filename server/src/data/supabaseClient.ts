import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

let client: AnySupabaseClient | undefined;

// One client per process, reused by every repository. Talks to Postgres via
// PostgREST (the .from() calls) and to Storage (the attachments bucket)
// using the service_role secret key — this server is the only thing that
// ever holds that key; it's never sent to the browser. Which Postgres
// *schema* it queries is controlled by SUPABASE_SCHEMA (defaults to
// "public"); the server's unit tests set this to "test" to run against an
// isolated copy of the same tables (see supabase/migrations/0001_init.sql).
export function getSupabaseClient(): AnySupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set — see .env / README\'s "Connecting to Supabase" section.',
    );
  }

  client = createClient(url, key, {
    db: { schema: process.env.SUPABASE_SCHEMA || 'public' },
    auth: { persistSession: false },
  });
  return client;
}

// Test-only escape hatch: forces the next getSupabaseClient() call to build
// a fresh client. Needed because SUPABASE_SCHEMA is read once, lazily, the
// first time getSupabaseClient() runs — without this, a test file that
// sets it after another module already triggered client creation would
// silently keep querying the wrong schema.
export function resetSupabaseClientForTests(): void {
  client = undefined;
}
