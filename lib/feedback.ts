import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { requireDb, schema as s } from "@/lib/db";
import { BookingError } from "@/lib/trips";

export const FEEDBACK_KINDS = {
  idea: "Idea or suggestion",
  problem: "Something isn't working",
  safety: "Safety concern",
  praise: "Something you liked",
} as const;
export const FEEDBACK_ROLES = { rider: "Rider", driver: "Driver", other: "Other" } as const;

/** At most this many messages per sender per hour. */
const PER_HOUR = 5;

export const feedbackInput = z.object({
  kind: z.enum(Object.keys(FEEDBACK_KINDS) as [keyof typeof FEEDBACK_KINDS], "Choose what it's about"),
  role: z.enum(Object.keys(FEEDBACK_ROLES) as [keyof typeof FEEDBACK_ROLES]).default("other"),
  message: z.string().trim().min(5, "Write a few words").max(2000, "Keep it under 2000 characters"),
  name: z.string().trim().max(60).optional().default(""),
  contact: z.string().trim().max(100).optional().default(""),
  page: z.string().trim().max(200).optional().default(""),
  ride: z.string().trim().max(40).optional().default(""),
  /** Hidden field people never see: filled in only by spam bots. */
  website: z.string().optional().default(""),
});

export async function submitFeedback(raw: unknown, ip: string | null) {
  const parsed = feedbackInput.safeParse(raw);
  if (!parsed.success) throw new BookingError(parsed.error.issues[0]?.message ?? "Check the form");
  const f = parsed.data;
  if (f.website) return; // a bot: pretend it worked
  const db = requireDb();
  const ipHash = ip ? createHash("sha256").update(`${process.env.AUTH_SECRET ?? ""}:${ip}`).digest("hex").slice(0, 32) : null;
  if (ipHash) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.feedback)
      .where(and(eq(s.feedback.ipHash, ipHash), gte(s.feedback.createdAt, new Date(Date.now() - 3600_000))));
    if (n >= PER_HOUR) throw new BookingError("Thank you! You've sent several messages already. Please try again in an hour.", 429);
  }
  await db.insert(s.feedback).values({
    kind: f.kind,
    role: f.role,
    message: f.message,
    name: f.name || null,
    contact: f.contact || null,
    page: f.page.startsWith("/") ? f.page : null,
    rideSlug: /^[A-Za-z0-9_-]{4,20}$/.test(f.ride) ? f.ride : null,
    ipHash,
  });
}

/* ---------- Super admin ---------- */

export async function feedbackList(status: "new" | "done" | "all" = "all") {
  return requireDb()
    .select()
    .from(s.feedback)
    .where(status === "all" ? undefined : eq(s.feedback.status, status))
    // Unhandled safety reports first.
    .orderBy(sql`(${s.feedback.kind} = 'safety' and ${s.feedback.status} = 'new') desc`, desc(s.feedback.createdAt))
    .limit(300);
}

export async function feedbackCounts() {
  const rows = await requireDb()
    .select({ status: s.feedback.status, n: sql<number>`count(*)::int` })
    .from(s.feedback)
    .groupBy(s.feedback.status);
  return { new: rows.find((r) => r.status === "new")?.n ?? 0, done: rows.find((r) => r.status === "done")?.n ?? 0 };
}

/** Latest driver reviews, with the ride they came from, for moderation. */
export async function latestReviews() {
  return requireDb()
    .select({ review: s.driverReviews, slug: s.rides.slug, driverName: s.rides.driverName })
    .from(s.driverReviews)
    .leftJoin(s.rides, eq(s.rides.id, s.driverReviews.rideId))
    .orderBy(desc(s.driverReviews.updatedAt))
    .limit(200);
}
