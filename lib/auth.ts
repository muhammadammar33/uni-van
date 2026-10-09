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

/** The signed-in admin (re-checked against the database), or a redirect to the login page. */
export const requireAdmin = cache(async () => {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session || !db) redirect("/admin/login");
  const [admin] = await db
    .select({ id: s.admins.id, email: s.admins.email, name: s.admins.name })
    .from(s.admins)
    .where(eq(s.admins.id, Number(session.sub)))
    .limit(1);
  if (!admin) redirect("/admin/login");
  return admin;
});
