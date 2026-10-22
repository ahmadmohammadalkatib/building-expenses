-- 0005: an apartment entered by mistake can be deleted while nothing was ever paid or adjusted on it.
--
-- * Its unpaid charges, apartment-specific fee rates and ownership rows go with it; the app writes
--   an audit entry first, so the deletion stays on record.
-- * Charges are still never deletable on their own: forbid_delete() lets a charge go only while
--   the transaction is deleting that charge's apartment (app.deleting_apartment) AND the apartment
--   has no payments (any kind or status) and no adjustments. Allocations only exist with payments.

grant delete on apartments, apartment_owners, owners, charges to app_server;

create or replace function forbid_delete() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'charges'
     and current_setting('app.deleting_apartment', true) = old.apartment_id::text
     and not exists (select 1 from public.payments where apartment_id = old.apartment_id)
     and not exists (select 1 from public.adjustments where apartment_id = old.apartment_id) then
    return old;
  end if;
  raise exception 'records in % cannot be deleted; void them instead', tg_table_name;
end $$;
