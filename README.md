# Building Expense Management

A single-building ledger for one administrator (plus optional treasurer / read-only users).
Arabic-first, right-to-left UI with an English toggle.

**Stack:** Next.js 15 (App Router, server actions) · TypeScript · Tailwind CSS 4 · Postgres on Supabase
(postgres.js, hand-written SQL) · Supabase Auth + Storage · Vercel (hosting + cron) · Vitest.

## The core rule: two ledgers, never mixed

| Ledger | Formula | Dated by | Changed by |
| --- | --- | --- | --- |
| Cash (the fund) | opening balance + payments − expenses | payment / expense date | payments, expenses, voids |
| Dues (what apartments owe) | charges − allocations − adjustments | billing month / due date | charges, allocations, adjustments |

A payment adds to cash once and reduces dues through its allocations. An adjustment/waiver touches
dues only. An expense touches cash only. Dashboards and reports always show the two separately.

## Decisions implemented

1. **Opening arrears & opening credit** per apartment (Settings → Apartment opening balances). Both are
   dues-side only and never change the fund.
2. **Overpayment → credit** from day one. Credit is applied automatically (oldest payment → oldest charge)
   whenever new charges are created, a charge is voided, or a payment/adjustment is voided.
3. **Void = never happened.** Voided rows stay visible but are excluded everywhere, including past
   months' reports. Receipt numbers of voided payments are kept and never reused.
4. **Charge status** = Unpaid / Partially paid / Paid **plus** a separate Overdue flag.
5. **Uniqueness** is a partial index on monthly charges only, so special assessments can repeat in a month.
6. **Timing:** a daily cron (`30 22 * * *` UTC ≈ after midnight Asia/Hebron) creates the current
   building-local month's charges if missing — idempotent, so repeats are harmless. Apartments are charged
   a full month from their *billing start month* (no prorating). A fee change can start in any month whose
   charges haven't been generated yet.

Also: oldest-first tie-break (due date → billing month → creation time); descriptive fields editable with
an audit entry, money fields require void + re-enter (enforced by DB triggers); dates before the opening
date or in the future are rejected; negative fund balance warns; month-end dues use allocation
**effective dates**; any admin-entered adjustment is approved; currency / time zone / opening balance
lock after the first transaction; receipts `R-2026-0001` from a per-year counter row (safe under
concurrency); payment and expense forms carry an idempotency key.

## Security model

- All data access is server-side through the restricted `app_server` Postgres role.
- RLS is enabled and forced on every table; only `app_server` has a policy. `anon` / `authenticated`
  have no table privileges, so Supabase's auto-generated REST API exposes nothing.
- Supabase Auth handles sign-in. Users are created by an admin in-app with a temporary password
  (no email service needed) via `SECURITY DEFINER` functions in the `app_private` schema.
- Every server action checks the role (`admin` > `treasurer` > `viewer`); the audit log is append-only
  (trigger-enforced) and posted money rows can't be deleted.

## Project layout

```
db/migrations/          SQL migrations (0003 is Supabase-specific: auth helpers + storage bucket)
src/lib/core/           pure accounting rules (money, dates, allocation, fees, status) — unit tested
src/lib/services/       transactional business logic + report queries — integration tested
src/app/(app)/          screens: dashboard, apartments, dues, payments, expenses, reports, settings, audit
src/app/api/            CSV export, cron endpoint
tests/                  core.test.ts (unit) + acceptance.test.ts (AC-01…AC-20 on real Postgres)
```

## Local development

```bash
pnpm install
cp .env.example .env.local   # fill in values
pnpm dev
```

### Tests

Integration tests need a local Postgres superuser; each run builds a throwaway database from
`db/migrations/0001` + `0002` and connects as `app_server`, exactly like production.

```bash
docker run -d -p 54329:5432 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16
TEST_PG_ADMIN_URL=postgres://postgres@127.0.0.1:54329/postgres pnpm test
```

## Deployment

1. Apply `db/migrations/*.sql` in order to the Supabase project.
2. Set the `app_server` password: `alter role app_server with login password '…';`
3. Vercel env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`
   (transaction pooler, port 6543, user `app_server.<project-ref>`), `CRON_SECRET`.
4. First admin: `select app_private.create_auth_user('you@example.com', '<password>');` then insert the
   returned id into `app_users` with role `admin`.

## Backups

The Supabase free plan has no downloadable backups. Before go-live either upgrade the project to Pro
(daily backups, 7-day retention) or schedule a nightly `pg_dump` of the `public` schema to S3/R2.
Restore: `psql "$DATABASE_URL_ADMIN" < dump.sql` into a fresh project, then re-apply step 2.
