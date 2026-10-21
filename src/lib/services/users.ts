import type { Sql } from "@/lib/db/client";
import { AppError, audit, requireRole, type Actor, type Role } from "./common";

export async function listUsers(sql: Sql) {
  return sql<{ id: string; email: string; full_name: string; role: Role; active: boolean; created_at: string }[]>`
    select id, email, full_name, role, active, created_at from app_users order by created_at`;
}

export async function getAppUser(sql: Sql, id: string) {
  const [u] = await sql<{ id: string; email: string; full_name: string; role: Role; active: boolean; must_change_password: boolean }[]>`
    select id, email, full_name, role, active, must_change_password from app_users where id = ${id}`;
  return u ?? null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createUser(
  sql: Sql,
  actor: Actor,
  input: { email: string; fullName: string; role: Role; tempPassword: string },
): Promise<string> {
  requireRole(actor, "admin");
  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email)) throw new AppError("invalid_email");
  if (input.tempPassword.length < 8) throw new AppError("password_too_short");
  return sql.begin(async (tx) => {
    const [exists] = await tx`select 1 from app_users where email = ${email}`;
    if (exists) throw new AppError("user_exists");
    let id: string;
    try {
      [{ id }] = await tx<{ id: string }[]>`select app_private.create_auth_user(${email}, ${input.tempPassword}) as id`;
    } catch (e) {
      if (String((e as Error).message).includes("already exists")) throw new AppError("user_exists");
      throw e;
    }
    await tx`insert into app_users (id, email, full_name, role, must_change_password)
             values (${id}, ${email}, ${input.fullName.trim()}, ${input.role}, true)`;
    await audit(tx, actor, "create", "user", id, { email, role: input.role });
    return id;
  });
}

export async function updateUser(sql: Sql, actor: Actor, id: string, input: { fullName: string; role: Role; active: boolean }) {
  requireRole(actor, "admin");
  if (id === actor.id && (input.role !== "admin" || !input.active)) throw new AppError("cannot_demote_self");
  await sql.begin(async (tx) => {
    await tx`update app_users set full_name = ${input.fullName.trim()}, role = ${input.role}, active = ${input.active} where id = ${id}`;
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from app_users where role = 'admin' and active`;
    if (n < 1) throw new AppError("last_admin");
    await tx`select app_private.set_auth_banned(${id}, ${!input.active})`;
    await audit(tx, actor, "update", "user", id, input);
  });
}

export async function resetUserPassword(sql: Sql, actor: Actor, id: string, tempPassword: string) {
  requireRole(actor, "admin");
  if (tempPassword.length < 8) throw new AppError("password_too_short");
  await sql.begin(async (tx) => {
    await tx`select app_private.set_auth_password(${id}, ${tempPassword})`;
    await tx`update app_users set must_change_password = true where id = ${id}`;
    await audit(tx, actor, "reset_password", "user", id, {});
  });
}

export async function changeOwnPassword(sql: Sql, actor: Actor, newPassword: string) {
  if (!actor.id) throw new AppError("forbidden");
  if (newPassword.length < 8) throw new AppError("password_too_short");
  await sql.begin(async (tx) => {
    await tx`select app_private.set_auth_password(${actor.id}, ${newPassword})`;
    await tx`update app_users set must_change_password = false where id = ${actor.id}`;
    await audit(tx, actor, "change_password", "user", actor.id, {});
  });
}
