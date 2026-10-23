import Link from "next/link";
import { authEnabled, currentUser } from "@/lib/account";

/** Header corner: the signed-in person's picture (to "My account"), or "Sign in". Nothing until sign-in is on. */
export async function AccountButton({ next = "/" }: { next?: string }) {
  if (!authEnabled()) return null;
  const u = await currentUser();
  if (!u)
    return (
      <Link href={`/signin?next=${encodeURIComponent(next)}`} className="shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold text-white/90 hover:bg-white/10">
        Sign in
      </Link>
    );
  return (
    <Link href="/me" className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-white/15 text-sm font-bold text-white ring-2 ring-white/30" aria-label="My account" title={u.name}>
      {u.picture ? (
        // eslint-disable-next-line @next/next/no-img-element -- Google profile picture
        <img src={u.picture} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
      ) : (
        u.name.slice(0, 1).toUpperCase()
      )}
    </Link>
  );
}
