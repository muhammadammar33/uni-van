/** A phone outline for showing screens on the home page. */
export function PhoneFrame({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div className={`w-[300px] rounded-[2.75rem] p-2.5 shadow-2xl sm:w-[320px] ${dark ? "bg-slate-700 shadow-black/50" : "bg-slate-900 shadow-teal-950/50"}`}>
      <div className="relative h-[600px] overflow-hidden rounded-[2.25rem] bg-white text-ink">
        <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-slate-900" />
        <div className="h-full overflow-hidden pt-7">{children}</div>
      </div>
    </div>
  );
}
