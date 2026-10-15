import { Logo } from "@/components/Logo";

/** Shown at once while a page loads, so a tap never looks ignored. */
export default function Loading() {
  return (
    <div className="min-h-dvh" aria-busy="true" aria-label="Loading">
      <div className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-brand/20">
        <div className="h-full w-1/3 animate-[loadbar_1.1s_ease-in-out_infinite] rounded-full bg-accent" />
      </div>
      <header className="bg-hero px-4 pb-16 pt-4 text-white">
        <div className="mx-auto max-w-5xl">
          <Logo light />
          <div className="mt-6 h-8 w-56 animate-pulse rounded-lg bg-white/15" />
          <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded bg-white/10" />
        </div>
      </header>
      <main className="mx-auto -mt-10 max-w-5xl space-y-3 px-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card space-y-3">
            <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </main>
    </div>
  );
}
