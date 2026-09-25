#!/usr/bin/env node
// Runs every .sql file in supabase/migrations/, in filename order, against
// DATABASE_URL (a direct Postgres connection string — see .env / README's
// "Connecting to Supabase" section). PostgREST/supabase-js can't run DDL
// (CREATE TABLE etc.), so schema changes go through this script instead of
// the app's normal runtime Supabase client.
//
//   npm run db:migrate
//
// Safe to re-run: every statement in the migrations is idempotent
// (IF NOT EXISTS throughout).
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function isPlaceholder(val) {
  if (!val) return true;
  const lower = val.toLowerCase();
  return lower.includes('your-project-ref') || lower.includes('your-db-password') || lower.includes('placeholder');
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf-8').split('\n')) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) {
      const key = match[1];
      const val = match[2].trim();
      if (!(key in process.env) || isPlaceholder(process.env[key]) || val) {
        process.env[key] = val;
      }
    }
  }
}

async function main() {
  loadDotEnv(path.resolve(__dirname, '../.env'));

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set (expected in .env at the repo root). See README\'s "Connecting to Supabase" section.');
    process.exit(1);
  }

  const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  if (files.length === 0) {
    console.log('No migration files found in', migrationsDir);
    return;
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      console.log(`Running ${file}...`);
      await client.query(sql);
      console.log(`  done.`);
    }
    console.log(`Applied ${files.length} migration file(s).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
