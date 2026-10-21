-- Editable dues and fees.
-- * A charge's amount is still never changed in place: "edit amount" voids the charge and
--   issues a replacement (linked via replaces_id), so history and receipts stay intact.
-- * One ACTIVE monthly charge per apartment+month (a voided one may sit beside its replacement).
--   The generator still skips months the user deleted, so they are not re-created automatically.
-- * Fee rates can be edited or deleted by admins.

alter table charges add column if not exists replaces_id uuid references charges(id);

create unique index if not exists charges_monthly_active_uq on charges (apartment_id, billing_month)
  where kind = 'monthly' and status = 'active';
drop index if exists charges_monthly_uq;

grant delete on fee_rates to app_server;
