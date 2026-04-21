/**
 * Database client — Turso (libSQL) via Drizzle ORM.
 *
 * Lazy client so the app can build without Turso creds in CI.
 */

import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

let _sqlite: Client | null = null;
let _db: LibSQLDatabase<typeof schema> | null = null;

function init() {
  if (_db) return { sqlite: _sqlite!, db: _db };
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL is not set. Add it to .env (use file:./local.db for dev).",
    );
  }
  _sqlite = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  _db = drizzle(_sqlite, { schema });
  return { sqlite: _sqlite, db: _db };
}

export const sqlite = new Proxy({} as Client, {
  get(_t, prop, r) {
    return Reflect.get(init().sqlite as unknown as object, prop, r);
  },
});

export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
  get(_t, prop, r) {
    return Reflect.get(init().db as unknown as object, prop, r);
  },
});

/**
 * Send multiple SQL statements to Turso in a single HTTP round-trip.
 * Do NOT use the `sqlite` Proxy for this — libSQL's Client uses private class
 * fields that break when `this` is a Proxy rather than the real instance.
 */
export function batchSql(stmts: Parameters<Client["batch"]>[0]) {
  return init().sqlite.batch(stmts);
}

export * from "./schema";
