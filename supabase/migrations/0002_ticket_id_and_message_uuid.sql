-- Two follow-ups to 0001_init.sql, both purely additive (no drops — safe to
-- run even if the tables already have rows):
--
-- 1. A Postgres-native ticket ID generator (TCK-000001, TCK-000002, ...) so
--    concurrent ticket creation can't collide on the same human-readable
--    id — replaces the old in-memory counter in server/src/utils/id.ts,
--    which only worked because data/db.json was a single-process JSON
--    file. Ticket rows are now inserted WITHOUT an id; a bigserial `seq`
--    column assigns a gap-free-enough number, and a BEFORE INSERT trigger
--    formats it into `id` before the row is written, so a normal
--    `insert(...).select()` gets the generated id back in the same round
--    trip.
--
-- 2. ticket_messages.id switches from an app-generated text id to a
--    DB-generated uuid, matching users/attachments — nothing in the app
--    depends on its old "MSG-..." string format (it's only ever used as a
--    React key / opaque identifier), so this simplifies message creation
--    to a plain insert with no id-generation step in application code.
--    attachments.message_id is converted to match.
do $$
declare
  target_schema text;
begin
  foreach target_schema in array array['public', 'test']
  loop
    -- (1) Ticket ID generation.
    execute format('alter table %I.tickets add column if not exists seq bigserial', target_schema);

    execute format($sql$
      create or replace function %I.set_ticket_id() returns trigger as $fn$
      begin
        if new.id is null then
          new.id := 'TCK-' || lpad(new.seq::text, 6, '0');
        end if;
        return new;
      end;
      $fn$ language plpgsql
    $sql$, target_schema);

    execute format(
      'create or replace trigger trg_set_ticket_id before insert on %I.tickets for each row execute function %I.set_ticket_id()',
      target_schema, target_schema
    );

    -- (2) ticket_messages.id / attachments.message_id -> uuid.
    execute format('alter table %I.attachments drop constraint if exists attachments_message_id_fkey', target_schema);
    execute format('alter table %I.ticket_messages alter column id drop default', target_schema);
    execute format('alter table %I.ticket_messages alter column id type uuid using id::uuid', target_schema);
    execute format('alter table %I.ticket_messages alter column id set default gen_random_uuid()', target_schema);
    execute format('alter table %I.attachments alter column message_id type uuid using message_id::uuid', target_schema);
    execute format(
      'alter table %I.attachments add constraint attachments_message_id_fkey foreign key (message_id) references %I.ticket_messages(id) on delete cascade',
      target_schema, target_schema
    );
  end loop;
end $$;
