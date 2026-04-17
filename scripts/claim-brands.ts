/**
 * Assign ownership of all pending brands to a real Clerk user_id.
 *
 * Use after your first sign-in:
 *   npx tsx scripts/claim-brands.ts user_XXX
 */
import "dotenv/config";
import { createClient } from "@libsql/client";

async function main() {
  const userId = process.argv[2];
  if (!userId || !userId.startsWith("user_")) {
    console.error("Usage: tsx scripts/claim-brands.ts user_XXX");
    process.exit(1);
  }

  const c = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const res = await c.execute({
    sql: "UPDATE brands SET owner_id = ? WHERE owner_id = 'user_pending_claim' RETURNING id, slug, name",
    args: [userId],
  });
  console.log(`Claimed ${res.rows.length} brand(s) for ${userId}:`);
  for (const row of res.rows) {
    console.log(`  - ${row.slug} (${row.name})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
