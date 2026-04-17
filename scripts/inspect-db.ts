/**
 * Safety check: what tables exist in the Turso DB before we run migrations.
 * Read-only.
 */
import "dotenv/config";
import { createClient } from "@libsql/client";

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const res = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  console.log("Tables in DB:");
  if (res.rows.length === 0) {
    console.log("  (empty)");
  } else {
    for (const row of res.rows) console.log(`  - ${row.name}`);
  }

  // Conflict check
  const ours = [
    "brands",
    "brand_economics",
    "ad_sources",
    "ad_accounts",
    "adsets",
    "ads",
    "ad_daily_stats",
    "adset_daily_stats",
    "csv_uploads",
    "creative_analyses",
    "recommendations",
    "notes",
  ];
  const existing = res.rows.map((r) => String(r.name));
  const conflicts = ours.filter((n) => existing.includes(n));
  console.log("\nConflicts with our schema:");
  if (conflicts.length === 0) {
    console.log("  NONE — safe to migrate.");
  } else {
    console.log("  ⚠️  WOULD OVERWRITE:");
    for (const c of conflicts) console.log(`    - ${c}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
