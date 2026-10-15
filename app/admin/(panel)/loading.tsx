/** Shown at once inside the admin panel while a page loads. */
export default function AdminLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-brand/20">
        <div className="h-full w-1/3 animate-[loadbar_1.1s_ease-in-out_infinite] rounded-full bg-accent" />
      </div>
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card flex items-center gap-3">
          <div className="size-10 shrink-0 animate-pulse rounded-full bg-slate-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
