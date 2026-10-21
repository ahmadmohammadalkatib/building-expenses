import postgres from "postgres";

export type Sql = postgres.Sql<Record<string, never>>;
export type Tx = postgres.TransactionSql<Record<string, never>>;
export type Db = Sql | Tx;

export function createSql(url: string, opts: { max?: number } = {}): Sql {
  return postgres(url, {
    max: opts.max ?? 5,
    prepare: false, // required for Supabase's transaction pooler
    idle_timeout: 20,
    connect_timeout: 15,
    onnotice: () => {},
    types: {
      // bigint agorot → JS number (safe up to 9e15)
      int8: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      // calendar dates stay as "YYYY-MM-DD" strings
      date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
      timestamptz: {
        to: 1184,
        from: [1184, 1114],
        serialize: (x: string | Date) => (x instanceof Date ? x.toISOString() : x),
        parse: (x: string) => new Date(x).toISOString(),
      },
    },
  }) as unknown as Sql;
}

declare global {
  var __sql: Sql | undefined;
}

/** Shared connection pool for the app server. */
export function db(): Sql {
  if (!globalThis.__sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalThis.__sql = createSql(url, { max: process.env.NODE_ENV === "production" ? 3 : 5 });
  }
  return globalThis.__sql;
}
