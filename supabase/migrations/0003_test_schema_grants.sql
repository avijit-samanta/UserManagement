-- Supabase auto-grants schema/table/sequence access to service_role (and
-- anon/authenticated) for the `public` schema, but NOT for a schema created
-- by hand via raw SQL — `test` needed the same grant explicitly, or every
-- query against it fails with "permission denied for schema test" even
-- once it's exposed to PostgREST (see README's "Connecting to Supabase").
--
-- service_role only, deliberately: nothing legitimate ever queries `test`
-- except the server's own unit tests (which always use the service_role
-- key — see server/src/test-setup.ts), so anon/authenticated get nothing
-- here, unlike public's usual grants.
grant usage on schema test to service_role;
grant all on all tables in schema test to service_role;
grant all on all sequences in schema test to service_role;
alter default privileges in schema test grant all on tables to service_role;
alter default privileges in schema test grant all on sequences to service_role;
