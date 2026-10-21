import type { Sql } from "@/lib/db/client";
import { checkTransactionDate } from "@/lib/core/accounting";
import { isIsoDate } from "@/lib/core/dates";
import { AppError, audit, getSettings, isUniqueViolation, requireRole, type Actor } from "./common";

export type Method = "cash" | "bank_transfer" | "cheque" | "card" | "other";

export interface NewExpense {
  categoryId: string;
  amount: number;
  date: string;
  vendor: string;
  description: string;
  method: Method;
  reference: string;
  attachmentPath: string | null;
  idempotencyKey: string;
}

export async function recordExpense(
  sql: Sql,
  actor: Actor,
  input: NewExpense,
  today: string,
): Promise<{ id: string; duplicate: boolean; negativeBalance: boolean }> {
  requireRole(actor, "treasurer");
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new AppError("invalid_amount");
  if (!isIsoDate(input.date)) throw new AppError("invalid_date");
  if (!input.description.trim() && !input.vendor.trim()) throw new AppError("description_required");
  const s = await getSettings(sql);
  if (!s.opening_date) throw new AppError("opening_not_set");
  const chk = checkTransactionDate(input.date, s.opening_date, today);
  if (chk !== "ok") throw new AppError(`date_${chk}`);
  const [cat] = await sql`select id from expense_categories where id = ${input.categoryId} and not archived`;
  if (!cat) throw new AppError("invalid_category");
  try {
    const [r] = await sql<{ id: string }[]>`
      insert into expenses (category_id, amount, expense_date, vendor, description, method, reference,
                            attachment_path, idempotency_key, created_by)
      values (${input.categoryId}, ${input.amount}, ${input.date}, ${input.vendor.trim()}, ${input.description.trim()},
              ${input.method}, ${input.reference.trim()}, ${input.attachmentPath}, ${input.idempotencyKey}, ${actor.id})
      returning id`;
    await audit(sql, actor, "create", "expense", r.id, { ...input });
    const [bal] = await sql<{ b: number }[]>`
      select (${s.opening_balance}::bigint
        + coalesce((select sum(amount) from payments where status = 'active' and kind = 'payment'), 0)
        - coalesce((select sum(amount) from expenses where status = 'active'), 0))::bigint as b`;
    return { id: r.id, duplicate: false, negativeBalance: bal.b < 0 };
  } catch (e) {
    if (isUniqueViolation(e, "expenses_idempotency_key_key")) {
      const [d] = await sql<{ id: string }[]>`select id from expenses where idempotency_key = ${input.idempotencyKey}`;
      return { id: d.id, duplicate: true, negativeBalance: false };
    }
    throw e;
  }
}

export async function voidExpense(sql: Sql, actor: Actor, id: string, reason: string) {
  requireRole(actor, "treasurer");
  if (!reason.trim()) throw new AppError("reason_required");
  await sql.begin(async (tx) => {
    const [e] = await tx<{ status: string }[]>`select status from expenses where id = ${id} for update`;
    if (!e) throw new AppError("not_found");
    if (e.status === "voided") throw new AppError("already_voided");
    await tx`update expenses set status = 'voided', void_reason = ${reason.trim()}, voided_at = now(), voided_by = ${actor.id}
             where id = ${id}`;
    await audit(tx, actor, "void", "expense", id, { reason });
  });
}

/** Descriptive fields only; amount and date require void + re-enter. */
export async function editExpenseDetails(
  sql: Sql,
  actor: Actor,
  id: string,
  input: { categoryId: string; vendor: string; description: string; method: Method; reference: string; attachmentPath?: string | null },
) {
  requireRole(actor, "treasurer");
  await sql.begin(async (tx) => {
    const [before] = await tx`select category_id, vendor, description, method, reference, attachment_path, status
                              from expenses where id = ${id} for update`;
    if (!before) throw new AppError("not_found");
    if (before.status === "voided") throw new AppError("already_voided");
    await tx`update expenses set category_id = ${input.categoryId}, vendor = ${input.vendor.trim()},
             description = ${input.description.trim()}, method = ${input.method}, reference = ${input.reference.trim()},
             attachment_path = ${input.attachmentPath === undefined ? before.attachment_path : input.attachmentPath}
             where id = ${id}`;
    await audit(tx, actor, "edit", "expense", id, { before, after: input });
  });
}
