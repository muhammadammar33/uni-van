"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Car, ChevronRight } from "lucide-react";
import { myRides } from "@/components/carpool/RideForm";

/** Rides this phone has offered (remembered locally), with their manage links. */
export function MyRides() {
  const [list, setList] = useState<{ slug: string; token: string; title: string }[]>([]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage after hydration
  useEffect(() => setList(myRides()), []);
  if (!list.length) return null;
  return (
    <section className="card">
      <h2 className="mb-2 flex items-center gap-2 font-bold">
        <Car className="size-5 text-brand" /> Your rides on this phone
      </h2>
      <ul className="divide-y divide-slate-100">
        {list.map((r) => (
          <li key={r.slug}>
            <Link href={`/r/manage/${r.token}`} className="flex items-center gap-2 py-2.5 text-sm font-medium hover:text-brand">
              <span className="min-w-0 flex-1 truncate">{r.title}</span>
              <span className="text-xs text-slate-400">Manage</span>
              <ChevronRight className="size-4 text-slate-300" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
