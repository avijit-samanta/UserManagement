-- Initial schema for the Simple Help Desk app, mirroring the shapes
-- previously stored in data/db.json (see server/src/models/types.ts).
--
-- Run against two schemas:
--   public — the real application data.
--   test   — an isolated copy used by the server's unit tests (see
--            server/src/data/repositories/*.test.ts), so tests never touch
--            real data and can freely TRUNCATE between runs.
--
-- RLS is intentionally NOT enabled: the Express server is the only client
-- that ever talks to Postgres (via the service_role key), and it already
-- enforces every authorization rule itself in server/src/routes/*.ts —
-- browsers never query Postgres directly. Turning on RLS here would just
-- mean re-implementing those same checks a second time in SQL for no
-- additional security, since there's no untrusted direct DB access to guard
-- against.
--
-- Idempotent: safe to re-run (CREATE ... IF NOT EXISTS throughout).

create extension if not exists pgcrypto;

do $$
declare
  target_schema text;
begin
  foreach target_schema in array array['public', 'test']
  loop
    execute format('create schema if not exists %I', target_schema);

    execute format($sql$
      create table if not exists %I.users (
        id uuid primary key default gen_random_uuid(),
        email text not null unique,
        password_hash text not null,
        role text not null check (role in ('admin', 'user')),
        name text not null,
        phone text not null default '',
        address text not null default '',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$, target_schema);

    execute format($sql$
      create table if not exists %I.tickets (
        id text primary key,
        title text not null,
        description text not null,
        submitted_by uuid not null references %I.users(id),
        submitted_by_name text not null,
        status text not null check (status in ('open', 'answered', 'closed')) default 'open',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$, target_schema, target_schema);

    execute format($sql$
      create table if not exists %I.ticket_messages (
        id text primary key,
        ticket_id text not null references %I.tickets(id) on delete cascade,
        body text not null,
        author_id uuid not null references %I.users(id),
        author_name text not null,
        author_role text not null check (author_role in ('admin', 'user')),
        created_at timestamptz not null default now()
      )
    $sql$, target_schema, target_schema, target_schema);

    execute format($sql$
      create table if not exists %I.attachments (
        id uuid primary key default gen_random_uuid(),
        file_name text not null,
        storage_path text not null,
        mime_type text not null,
        size bigint not null,
        topic text not null,
        ticket_id text references %I.tickets(id) on delete cascade,
        message_id text references %I.ticket_messages(id) on delete cascade,
        uploaded_by uuid not null references %I.users(id),
        uploaded_by_name text not null,
        uploaded_by_role text not null check (uploaded_by_role in ('admin', 'user')),
        created_at timestamptz not null default now()
      )
    $sql$, target_schema, target_schema, target_schema, target_schema);

    execute format('create index if not exists idx_%1$s_tickets_submitted_by on %1$I.tickets(submitted_by)', target_schema);
    execute format('create index if not exists idx_%1$s_messages_ticket_id on %1$I.ticket_messages(ticket_id)', target_schema);
    execute format('create index if not exists idx_%1$s_attachments_ticket_id on %1$I.attachments(ticket_id)', target_schema);
    execute format('create index if not exists idx_%1$s_attachments_message_id on %1$I.attachments(message_id)', target_schema);
    execute format('create index if not exists idx_%1$s_attachments_uploaded_by on %1$I.attachments(uploaded_by)', target_schema);
  end loop;
end $$;
