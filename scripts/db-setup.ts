/**
 * Applies migrations, adds the default vehicles when there are none, and creates the first (super) admin
 * from ADMIN_EMAIL / ADMIN_PASSWORD. Safe to run on every deploy; skips when DATABASE_URL is not set.
 */
import bcrypt from "bcryptjs";
import { asc, count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as s from "../lib/db/schema";
import { busLayout, hiaceLayout } from "../lib/layout";
import { slugify } from "../lib/orgTypes";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[db-setup] DATABASE_URL not set, skipping.");
    return;
  }
  const client = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema: s });

  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("[db-setup] migrations applied");

  // The migration to organisations puts everything that existed before into one organisation called
  // "My van service". Give it the brand name this deployment used until now, if there was one.
  const [firstOrg] = await db.select().from(s.organizations).orderBy(asc(s.organizations.id)).limit(1);
  const legacyName = process.env.NEXT_PUBLIC_BRAND_NAME?.trim();
  if (firstOrg?.name === "My van service" && legacyName && legacyName !== "Hamsafar") {
    await db.update(s.organizations).set({ name: legacyName, slug: slugify(legacyName) }).where(eq(s.organizations.id, firstOrg.id));
    console.log(`[db-setup] named the first organisation "${legacyName}"`);
  }

  const [{ n: vehicleCount }] = await db.select({ n: count() }).from(s.vehicles);
  if (vehicleCount === 0 && firstOrg) {
    await db.insert(s.vehicles).values([
      { orgId: firstOrg.id, name: "Toyota Hiace (15 seats)", layout: hiaceLayout() },
      { orgId: firstOrg.id, name: "Coaster (29 seats)", layout: busLayout(6) },
    ]);
    console.log("[db-setup] added default vehicles");
  }

  const [{ n: adminCount }] = await db.select({ n: count() }).from(s.admins);
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (adminCount === 0) {
    if (email && password) {
      await db.insert(s.admins).values({ email, name: "Admin", role: "super", passwordHash: await bcrypt.hash(password, 12) });
      console.log(`[db-setup] created admin ${email}`);
    } else {
      console.warn("[db-setup] no admins yet: set ADMIN_EMAIL and ADMIN_PASSWORD and run again to create the first one.");
    }
  }

  await client.end();
}

main().catch((err) => {
  console.error("[db-setup] failed:", err);
  process.exit(1);
});
