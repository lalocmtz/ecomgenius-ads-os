/**
 * Run Drizzle migrations against Turso.
 *
 * Usage:
 *   npm run db:migrate
 */
import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("TURSO_DATABASE_URL is not set");
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  const db = drizzle(client);
  console.log("[migrate] Applying migrations…");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[migrate] Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
