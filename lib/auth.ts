import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, schema as s } from "@/lib/db";
import { SESSION_COOKIE, SESSION_TTL, signSession, verifySession } from "@/lib/session";

export async function startSession(admin: { id: number; email: string; name: string }) {
  const token = await signSession({ sub: String(admin.id), email: admin.email, name: admin.name });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Which organisation a super admin is currently working in (organisation admins are fixed to their own). */
export const ORG_COOKIE = "van_org";

/** The signed-in admin (re-checked against the database), or a redirect to the login page. */
export const requireAdmin = cache(async () => {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session || !db) redirect("/admin/login");
  const [row] = await db
    .select({ id: s.admins.id, email: s.admins.email, name: s.admins.name, role: s.admins.role, orgId: s.admins.orgId, orgActive: s.organizations.active })
    .from(s.admins)
    .leftJoin(s.organizations, eq(s.organizations.id, s.admins.orgId))
    .where(eq(s.admins.id, Number(session.sub)))
    .limit(1);
  // An organisation admin whose organisation was switched off is signed out.
  if (!row || (row.role !== "super" && (!row.orgId || row.orgActive === false))) redirect("/admin/login");
  const { orgActive: _active, ...admin } = row; // eslint-disable-line @typescript-eslint/no-unused-vars
  return admin;
});
export type Admin = Awaited<ReturnType<typeof requireAdmin>>;

export const requireSuper = cache(async () => {
  const admin = await requireAdmin();
  if (admin.role !== "super") redirect("/admin");
  return admin;
});

/**
 * The organisation the admin is working in: their own, or for a super admin the one they opened
 * (no organisation open sends them to the organisations list).
 */
export const requireOrg = cache(async () => {
  const admin = await requireAdmin();
  const orgId = admin.role === "super" ? Number((await cookies()).get(ORG_COOKIE)?.value) : admin.orgId;
  const [org] = orgId && db ? await db.select().from(s.organizations).where(eq(s.organizations.id, orgId)).limit(1) : [];
  if (!org) redirect(admin.role === "super" ? "/admin/orgs" : "/admin/login");
  return { admin, org };
});
