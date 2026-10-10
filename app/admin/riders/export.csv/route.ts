import { asc, eq } from "drizzle-orm";
import { requireOrg } from "@/lib/auth";
import { requireDb, schema as s } from "@/lib/db";
import { displayPhone } from "@/lib/format";
import { slugify } from "@/lib/orgTypes";
import { toCsv } from "@/lib/riders";

/** The organisation's rider list as CSV, in the same layout the import accepts. */
export async function GET() {
  const { org } = await requireOrg();
  const rows = await requireDb().select().from(s.riders).where(eq(s.riders.orgId, org.id)).orderBy(asc(s.riders.name));
  const csv = toCsv([
    ["Name", "Phone", "Gender", "Roll No", "Class", "Stop", "Active"],
    ...rows.map((r) => [r.name, displayPhone(r.phone), r.gender === "female" ? "Female" : "Male", r.refNo, r.groupName, r.stop, r.active ? "Yes" : "No"]),
  ]);
  return new Response("﻿" + csv + "\n", {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${slugify(org.name)}-riders.csv"` },
  });
}
