import type { Db } from "@/lib/db/client";
import { todayIn } from "@/lib/core/dates";

export type Role = "admin" | "treasurer" | "viewer";

export interface Actor {
  id: string | null; // null = system (cron)
  email: string;
  role: Role | "system";
}

export const SYSTEM: Actor = { id: null, email: "system", role: "system" };

/** A user-facing error. `code` is an i18n key under `errors.*`. */
export class AppError extends Error {
  constructor(
    public code: string,
    public params: Record<string, string | number> = {},
  ) {
    super(code);
    this.name = "AppError";
  }
}

const RANK: Record<Role | "system", number> = { viewer: 1, treasurer: 2, admin: 3, system: 4 };

/** Treasurer may record money; only admins change setup, users, voids of others… */
export function requireRole(actor: Actor, min: Role) {
  if (RANK[actor.role] < RANK[min]) throw new AppError("forbidden");
}

export async function audit(
  sql: Db,
  actor: Actor,
  action: string,
  entity: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  await sql`
    insert into audit_log (user_id, user_email, action, entity, entity_id, details)
    values (${actor.id}, ${actor.email}, ${action}, ${entity}, ${entityId}, ${sql.json(details as never)})`;
}

export interface Settings {
  building_name: string;
  building_address: string;
  currency: string;
  timezone: string;
  opening_balance: number;
  opening_date: string | null;
  due_day: number;
  receipt_prefix: string;
  receipt_footer: string;
}

export async function getSettings(sql: Db): Promise<Settings> {
  const [s] = await sql<Settings[]>`select * from settings where id = 1`;
  return s;
}

export async function today(sql: Db): Promise<string> {
  const s = await getSettings(sql);
  return todayIn(s.timezone);
}

export function isUniqueViolation(e: unknown, constraint?: string): boolean {
  const err = e as { code?: string; constraint_name?: string };
  return err?.code === "23505" && (!constraint || err.constraint_name === constraint);
}
