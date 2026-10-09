/** Skeleton while the trip loads (slow mobile data). */
export default function Loading() {
  return (
    <div className="min-h-dvh animate-pulse">
      <div className="bg-hero h-52" />
      <div className="mx-auto -mt-8 max-w-lg space-y-4 px-4">
        {[120, 220, 380].map((h) => (
          <div key={h} className="rounded-2xl bg-white shadow-soft" style={{ height: h }} />
        ))}
      </div>
    </div>
  );
}
