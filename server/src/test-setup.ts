// Runs once before every test file (see vitest.config.ts's setupFiles).
// Loads .env from the repo root (same file the app itself reads — see
// index.ts) and points every repository at the `test` Postgres schema
// instead of `public`, so unit tests never touch real data.
//
// This means the repository tests need real network access to the
// project's Supabase instance and require the `test` schema to be added
// under Project Settings -> API -> "Exposed schemas" (PostgREST rejects
// any schema not explicitly listed there) — see README's "Connecting to
// Supabase" section.
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
process.env.SUPABASE_SCHEMA = 'test';
