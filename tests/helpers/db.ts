// Integration-test database: a fresh Postgres database per test file, built from the
// real migrations, accessed as the restricted `app_server` role (same as production).
// Requires TEST_PG_ADMIN_URL (superuser), e.g. postgres://postgres@localhost:54329/postgres

import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { createSql, type Sql } from "@/lib/db/client";
import type { Actor } from "@/lib/services/common";

const ADMIN_URL = process.env.TEST_PG_ADMIN_URL ?? "postgres://postgres@127.0.0.1:54329/postgres";
const MIGRATIONS = ["0001_schema.sql", "0002_security.sql"];

export const hasTestDb = !!ADMIN_URL;

export async function freshDb(): Promise<{ sql: Sql; drop: () => Promise<void> }> {
  const name = `be_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const admin = postgres(ADMIN_URL, { onnotice: () => {} });
  await admin.unsafe(`create database ${name}`);
  await admin.end();

  const dbUrl = new URL(ADMIN_URL);
  dbUrl.pathname = `/${name}`;
  const owner = postgres(dbUrl.toString(), { onnotice: () => {} });
  for (const f of MIGRATIONS) {
    await owner.unsafe(readFileSync(path.join(__dirname, "../../db/migrations", f), "utf8"));
  }
  await owner.unsafe(`alter role app_server login password 'test'`);
  await owner.end();

  const appUrl = new URL(dbUrl.toString());
  appUrl.username = "app_server";
  appUrl.password = "test";
  const sql = createSql(appUrl.toString(), { max: 6 });
  return {
    sql,
    drop: async () => {
      await sql.end();
      const a = postgres(ADMIN_URL, { onnotice: () => {} });
      await a.unsafe(`drop database if exists ${name} with (force)`);
      await a.end();
    },
  };
}

export const ADMIN: Actor = { id: "00000000-0000-0000-0000-000000000001", email: "admin@test", role: "admin" };
export const VIEWER: Actor = { id: "00000000-0000-0000-0000-000000000002", email: "viewer@test", role: "viewer" };

let seq = 0;
export const key = () => `k-${Date.now()}-${++seq}`;
