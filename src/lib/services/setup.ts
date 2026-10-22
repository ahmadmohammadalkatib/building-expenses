// Settings, fees, apartments, owners, categories.

import type { Db, Sql, Tx } from "@/lib/db/client";
import { isIsoDate, monthStart } from "@/lib/core/dates";
import { normalizePhone } from "@/lib/core/phone";
import { AppError, audit, getSettings, isUniqueViolation, requireRole, type Actor, type Settings } from "./common";
import { applyApartmentCredit, catchUpChargesInTx, repriceIssuedMonthlyInTx } from "./ledger";

// ------------------------------------------------------------------ settings

export async function hasTransactions(sql: Db): Promise<boolean> {
  const [r] = await sql<{ n: boolean }[]>`
    select exists (select 1 from payments where kind = 'payment') or exists (select 1 from expenses) as n`;
  return r.n;
}

export async function updateSettings(sql: Sql, actor: Actor, input: Partial<Settings>) {
  requireRole(actor, "admin");
  await sql.begin(async (tx) => {
    const before = await getSettings(tx);
    const locked = await hasTransactions(tx);
    const next = { ...before, ...input };
    if (locked) {
      // Currency, time zone and the opening balance are locked once money has moved.
      for (const k of ["currency", "timezone", "opening_balance", "opening_date"] as const) {
        if (input[k] !== undefined && input[k] !== before[k]) throw new AppError("settings_locked");
      }
    }
    if (next.opening_date && !isIsoDate(next.opening_date)) throw new AppError("invalid_date");
    if (!Number.isSafeInteger(next.opening_balance)) throw new AppError("invalid_amount");
    if (next.due_day < 1 || next.due_day > 28) throw new AppError("invalid_due_day");
    if (!/^[A-Za-z]{1,6}$/.test(next.receipt_prefix)) throw new AppError("invalid_prefix");
    try {
      Intl.DateTimeFormat("en", { timeZone: next.timezone });
    } catch {
      throw new AppError("invalid_timezone");
    }
    await tx`
      update settings set
        building_name = ${next.building_name.trim()}, building_address = ${next.building_address.trim()},
        currency = ${next.currency}, timezone = ${next.timezone}, opening_balance = ${next.opening_balance},
        opening_date = ${next.opening_date}, due_day = ${next.due_day}, receipt_prefix = ${next.receipt_prefix},
        receipt_footer = ${next.receipt_footer.trim()}, updated_at = now()
      where id = 1`;
    await audit(tx, actor, "update", "settings", "1", { before, after: next });
  });
}

// ------------------------------------------------------------------ fees

export async function listFees(sql: Db) {
  return sql<
    { id: string; apartment_id: string | null; apartment_number: string | null; amount: number; effective_from: string; note: string }[]
  >`
    select f.id, f.apartment_id, a.number as apartment_number, f.amount, f.effective_from, f.note
    from fee_rates f left join apartments a on a.id = f.apartment_id
    order by f.apartment_id nulls first, a.number, f.effective_from desc`;
}

/**
 * Add an effective-dated fee. When `applyToIssued` is set, monthly charges already issued from that
 * month on are re-priced to the new fee (payments on them are re-applied automatically).
 */
export async function addFee(
  sql: Sql,
  actor: Actor,
  input: { apartmentId: string | null; amount: number; effectiveFrom: string; note: string; applyToIssued?: boolean },
  today?: string,
) {
  requireRole(actor, "admin");
  if (!isIsoDate(input.effectiveFrom)) throw new AppError("invalid_date");
  if (!Number.isSafeInteger(input.amount) || input.amount < 0) throw new AppError("invalid_amount");
  const m = monthStart(input.effectiveFrom);
  try {
    return await sql.begin(async (tx) => {
      const [r] = await tx<{ id: string }[]>`
        insert into fee_rates (apartment_id, amount, effective_from, note, created_by)
        values (${input.apartmentId}, ${input.amount}, ${m}, ${input.note.trim()}, ${actor.id}) returning id`;
      await audit(tx, actor, "create", "fee_rate", r.id, { ...input, effectiveFrom: m });
      await afterFeeChange(tx, actor, m, input.apartmentId, input.applyToIssued ?? true, today, "fee_added");
      return r.id;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("fee_exists");
    throw e;
  }
}

export async function updateFee(
  sql: Sql,
  actor: Actor,
  id: string,
  input: { amount: number; note: string; applyToIssued: boolean },
  today?: string,
) {
  requireRole(actor, "admin");
  if (!Number.isSafeInteger(input.amount) || input.amount < 0) throw new AppError("invalid_amount");
  await sql.begin(async (tx) => {
    const [before] = await tx<{ apartment_id: string | null; amount: number; effective_from: string; note: string }[]>`
      select apartment_id, amount, effective_from, note from fee_rates where id = ${id} for update`;
    if (!before) throw new AppError("not_found");
    await tx`update fee_rates set amount = ${input.amount}, note = ${input.note.trim()} where id = ${id}`;
    await audit(tx, actor, "update", "fee_rate", id, { before, after: input });
    await afterFeeChange(tx, actor, before.effective_from, before.apartment_id, input.applyToIssued, today, "fee_changed");
  });
}

export async function deleteFee(sql: Sql, actor: Actor, id: string, applyToIssued: boolean, today?: string) {
  requireRole(actor, "admin");
  await sql.begin(async (tx) => {
    const [before] = await tx<{ apartment_id: string | null; amount: number; effective_from: string; note: string }[]>`
      select apartment_id, amount, effective_from, note from fee_rates where id = ${id} for update`;
    if (!before) throw new AppError("not_found");
    await tx`delete from fee_rates where id = ${id}`;
    await audit(tx, actor, "delete", "fee_rate", id, { before });
    await afterFeeChange(tx, actor, before.effective_from, before.apartment_id, applyToIssued, today, "fee_deleted");
  });
}

async function afterFeeChange(
  tx: Tx,
  actor: Actor,
  fromMonth: string,
  apartmentId: string | null,
  applyToIssued: boolean,
  today: string | undefined,
  reason: string,
) {
  if (applyToIssued) await repriceIssuedMonthlyInTx(tx, actor, fromMonth, apartmentId, reason);
  // A fee effective now (or earlier) bills un-charged months right away.
  if (today && monthStart(fromMonth) <= monthStart(today)) {
    await catchUpChargesInTx(tx, actor, today, apartmentId ?? undefined);
  }
}

// ------------------------------------------------------------------ apartments & owners

export interface ApartmentInput {
  number: string;
  floor: number | null;
  billingStartMonth: string;
  notes: string;
}

export async function createApartment(
  sql: Sql,
  actor: Actor,
  input: ApartmentInput,
  owner?: OwnerInput & { startDate: string },
  today?: string,
) {
  requireRole(actor, "treasurer");
  if (!input.number.trim()) throw new AppError("number_required");
  if (!isIsoDate(input.billingStartMonth)) throw new AppError("invalid_date");
  try {
    return await sql.begin(async (tx) => {
      const [a] = await tx<{ id: string }[]>`
        insert into apartments (number, floor, billing_start_month, notes)
        values (${input.number.trim()}, ${input.floor}, ${monthStart(input.billingStartMonth)}, ${input.notes.trim()})
        returning id`;
      await audit(tx, actor, "create", "apartment", a.id, { ...input });
      if (owner && owner.fullName.trim()) {
        const ownerId = await insertOwner(tx, owner);
        await tx`insert into apartment_owners (apartment_id, owner_id, start_date)
                 values (${a.id}, ${ownerId}, ${owner.startDate})`;
        await audit(tx, actor, "assign_owner", "apartment", a.id, { ownerId, ...owner });
      }
      // Charge the apartment right away for every month from billing start to now.
      if (today) await catchUpChargesInTx(tx, actor, today, a.id);
      return a.id;
    });
  } catch (e) {
    if (isUniqueViolation(e, "apartments_number_uq")) throw new AppError("apartment_exists");
    throw e;
  }
}

export async function updateApartment(sql: Sql, actor: Actor, id: string, input: ApartmentInput, today?: string) {
  requireRole(actor, "treasurer");
  if (!input.number.trim()) throw new AppError("number_required");
  try {
    await sql.begin(async (tx) => {
      const [before] = await tx`select number, floor, billing_start_month, notes from apartments where id = ${id} for update`;
      if (!before) throw new AppError("not_found");
      const newStart = monthStart(input.billingStartMonth);
      if (newStart !== before.billing_start_month) {
        const [c] = await tx<{ n: number }[]>`select count(*)::int as n from charges where apartment_id = ${id} and kind = 'monthly' and status = 'active'`;
        if (c.n > 0) throw new AppError("billing_start_locked");
      }
      await tx`update apartments set number = ${input.number.trim()}, floor = ${input.floor},
               billing_start_month = ${newStart}, notes = ${input.notes.trim()} where id = ${id}`;
      await audit(tx, actor, "update", "apartment", id, { before, after: input });
      if (today) await catchUpChargesInTx(tx, actor, today, id);
    });
  } catch (e) {
    if (isUniqueViolation(e, "apartments_number_uq")) throw new AppError("apartment_exists");
    throw e;
  }
}

export async function setApartmentArchived(sql: Sql, actor: Actor, id: string, archivedOn: string | null) {
  requireRole(actor, "treasurer");
  await sql`update apartments set archived_at = ${archivedOn} where id = ${id}`;
  await audit(sql, actor, archivedOn ? "archive" : "unarchive", "apartment", id, { archivedOn });
}

/** True while nothing was ever paid or adjusted on the apartment (any status) — the only case it may be deleted. */
export async function apartmentDeletable(sql: Db, id: string): Promise<boolean> {
  const [r] = await sql<{ ok: boolean }[]>`
    select not exists (select 1 from payments where apartment_id = ${id})
       and not exists (select 1 from adjustments where apartment_id = ${id}) as ok`;
  return r.ok;
}

/**
 * Delete an apartment entered by mistake, with its unpaid charges, its own fee rates and ownership rows.
 * Refused once any payment or adjustment exists (archive it instead); the DB trigger enforces the same rule.
 */
export async function deleteApartment(sql: Sql, actor: Actor, id: string, confirmNumber: string) {
  requireRole(actor, "treasurer");
  await sql.begin(async (tx) => {
    const [a] = await tx<{ number: string }[]>`select number from apartments where id = ${id} for update`;
    if (!a) throw new AppError("not_found");
    if (confirmNumber.trim().toLowerCase() !== a.number.toLowerCase()) throw new AppError("confirm_mismatch");
    if (!(await apartmentDeletable(tx, id))) throw new AppError("apartment_has_payments");
    const [c] = await tx<{ n: number; total: number }[]>`
      select count(*)::int as n, coalesce(sum(amount) filter (where status = 'active'), 0)::bigint as total
      from charges where apartment_id = ${id}`;
    const owners = await tx<{ owner_id: string }[]>`select owner_id from apartment_owners where apartment_id = ${id}`;
    await audit(tx, actor, "delete", "apartment", id, { number: a.number, charges: c.n, chargedTotal: c.total });
    await tx`select set_config('app.deleting_apartment', ${id}, true)`;
    await tx`delete from charges where apartment_id = ${id}`;
    await tx`delete from fee_rates where apartment_id = ${id}`;
    await tx`delete from apartment_owners where apartment_id = ${id}`;
    for (const o of owners) {
      await tx`delete from owners where id = ${o.owner_id}
               and not exists (select 1 from apartment_owners where owner_id = ${o.owner_id})`;
    }
    await tx`delete from apartments where id = ${id}`;
  });
}

export interface OwnerInput {
  fullName: string;
  phone: string;
  email: string;
  notes: string;
}

async function insertOwner(sql: Db, o: OwnerInput): Promise<string> {
  const phone = o.phone.trim() ? normalizePhone(o.phone) : null;
  if (o.phone.trim() && !phone) throw new AppError("invalid_phone");
  const [r] = await sql<{ id: string }[]>`
    insert into owners (full_name, phone, email, notes)
    values (${o.fullName.trim()}, ${phone}, ${o.email.trim() || null}, ${o.notes.trim()}) returning id`;
  return r.id;
}

export async function updateOwner(sql: Sql, actor: Actor, ownerId: string, o: OwnerInput) {
  requireRole(actor, "treasurer");
  if (!o.fullName.trim()) throw new AppError("name_required");
  const phone = o.phone.trim() ? normalizePhone(o.phone) : null;
  if (o.phone.trim() && !phone) throw new AppError("invalid_phone");
  await sql`update owners set full_name = ${o.fullName.trim()}, phone = ${phone}, email = ${o.email.trim() || null},
            notes = ${o.notes.trim()} where id = ${ownerId}`;
  await audit(sql, actor, "update", "owner", ownerId, { ...o, phone });
}

/** Ownership change: closes the current ownership and starts a new one (history is kept). */
export async function changeOwner(sql: Sql, actor: Actor, apartmentId: string, owner: OwnerInput, startDate: string) {
  requireRole(actor, "treasurer");
  if (!owner.fullName.trim()) throw new AppError("name_required");
  if (!isIsoDate(startDate)) throw new AppError("invalid_date");
  await sql.begin(async (tx) => {
    const [cur] = await tx<{ id: string; start_date: string }[]>`
      select id, start_date from apartment_owners where apartment_id = ${apartmentId} and end_date is null for update`;
    if (cur) {
      if (startDate < cur.start_date) throw new AppError("owner_date_before_current");
      await tx`update apartment_owners set end_date = ${startDate} where id = ${cur.id}`;
    }
    const ownerId = await insertOwner(tx, owner);
    await tx`insert into apartment_owners (apartment_id, owner_id, start_date) values (${apartmentId}, ${ownerId}, ${startDate})`;
    await audit(tx, actor, "change_owner", "apartment", apartmentId, { ownerId, ...owner, startDate });
  });
}

// ------------------------------------------------------------------ go-live balances

/** Debt an apartment already had before go-live. Dated on the opening date. */
export async function setOpeningArrears(sql: Sql, actor: Actor, apartmentId: string, amount: number) {
  requireRole(actor, "treasurer");
  const s = await getSettings(sql);
  if (!s.opening_date) throw new AppError("opening_not_set");
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new AppError("invalid_amount");
  await sql.begin(async (tx) => {
    await tx`select id from apartments where id = ${apartmentId} for update`;
    const [ins] = await tx<{ id: string }[]>`
      insert into charges (apartment_id, kind, billing_month, due_date, amount, description, created_by)
      values (${apartmentId}, 'opening', ${monthStart(s.opening_date!)}, ${s.opening_date}, ${amount}, '', ${actor.id})
      returning id`;
    await applyApartmentCredit(tx, apartmentId);
    await audit(tx, actor, "create", "opening_arrears", ins.id, { apartmentId, amount });
  });
}

// ------------------------------------------------------------------ categories

export async function listCategories(sql: Db, includeArchived = false) {
  return sql<{ id: string; name_ar: string; name_en: string; archived: boolean; sort: number }[]>`
    select id, name_ar, name_en, archived, sort from expense_categories
    where ${includeArchived} or not archived order by sort, name_ar`;
}

export async function saveCategory(
  sql: Sql,
  actor: Actor,
  input: { id?: string; nameAr: string; nameEn: string; archived?: boolean; sort?: number },
) {
  requireRole(actor, "admin");
  if (!input.nameAr.trim()) throw new AppError("name_required");
  if (input.id) {
    await sql`update expense_categories set name_ar = ${input.nameAr.trim()}, name_en = ${input.nameEn.trim()},
              archived = ${input.archived ?? false}, sort = ${input.sort ?? 0} where id = ${input.id}`;
    await audit(sql, actor, "update", "category", input.id, input);
    return input.id;
  }
  const [r] = await sql<{ id: string }[]>`
    insert into expense_categories (name_ar, name_en, sort) values (${input.nameAr.trim()}, ${input.nameEn.trim()}, ${input.sort ?? 50})
    returning id`;
  await audit(sql, actor, "create", "category", r.id, input);
  return r.id;
}
