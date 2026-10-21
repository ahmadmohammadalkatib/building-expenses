-- Supabase-only: user management without email delivery or the service-role key.
-- The admin creates users with a temporary password from inside the app; these
-- SECURITY DEFINER functions are executable by app_server only.

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to app_server;

create or replace function app_private.create_auth_user(p_email text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
begin
  if length(p_password) < 8 then
    raise exception 'password too short';
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'user already exists';
  end if;
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text, 'email',
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
          now(), now(), now());
  return v_id;
end $$;

create or replace function app_private.set_auth_password(p_user uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if length(p_password) < 8 then
    raise exception 'password too short';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
   where id = p_user;
  if not found then raise exception 'user not found'; end if;
end $$;

create or replace function app_private.set_auth_banned(p_user uuid, p_banned boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update auth.users
     set banned_until = case when p_banned then 'infinity'::timestamptz else null end, updated_at = now()
   where id = p_user;
end $$;

revoke all on function app_private.create_auth_user(text, text) from public;
revoke all on function app_private.set_auth_password(uuid, text) from public;
revoke all on function app_private.set_auth_banned(uuid, boolean) from public;
grant execute on function app_private.create_auth_user(text, text) to app_server;
grant execute on function app_private.set_auth_password(uuid, text) to app_server;
grant execute on function app_private.set_auth_banned(uuid, boolean) to app_server;

-- Private bucket for expense receipt files. Accessed server-side with the signed-in
-- user's session; only active app users may read/write.
create or replace function app_private.is_app_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_users u where u.id = auth.uid() and u.active);
$$;
grant execute on function app_private.is_app_user() to authenticated;
grant usage on schema app_private to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expense-files', 'expense-files', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

create policy expense_files_read on storage.objects for select to authenticated
  using (bucket_id = 'expense-files' and app_private.is_app_user());
create policy expense_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'expense-files' and app_private.is_app_user());
