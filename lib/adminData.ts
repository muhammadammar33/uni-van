import "server-only";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth";
import { loadTrip } from "@/lib/trips";

/** A trip of the organisation the admin is working in, with its stops and bookings; 404 for anything else. */
export async function adminTrip(rawId: string) {
  const { org } = await requireOrg();
  const id = Number(rawId);
  const data = Number.isInteger(id) ? await loadTrip({ id }) : null;
  if (!data || data.trip.orgId !== org.id) notFound();
  return { ...data, id };
}
