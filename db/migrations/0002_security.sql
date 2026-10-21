-- Security: all data access goes through the app server using the dedicated `app_server`
-- role. Supabase's auto-generated REST API (anon / authenticated keys) gets nothing:
-- RLS is on for every table and only app_server has a policy.
-- The app_server password is set outside migrations (never committed).

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_server') then
    create role app_server nologin;
  end if;
end $$;

grant usage on schema public to app_server;
grant select, insert, update on all tables in schema public to app_server;
grant usage, select on all sequences in schema public to app_server;
revoke update on audit_log from app_server;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists app_server_all on public.%I', t);
    execute format('create policy app_server_all on public.%I to app_server using (true) with check (true)', t);
  end loop;
end $$;

-- Remove Supabase API roles' table/view privileges entirely (defense in depth).
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon, authenticated';
    execute 'revoke all on all sequences in schema public from anon, authenticated';
    execute 'revoke all on all functions in schema public from anon, authenticated';
    execute 'alter default privileges in schema public revoke all on tables from anon, authenticated';
    execute 'alter default privileges in schema public revoke all on functions from anon, authenticated';
  end if;
end $$;
