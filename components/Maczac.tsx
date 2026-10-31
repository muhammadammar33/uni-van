import Image from "next/image";
import { BRAND } from "@/lib/brand";

/** "MACZAC presents": the parent organisation's logo on a white badge (its tagline needs a light background). */
export function MaczacPresents({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="inline-flex rounded-xl bg-white px-2.5 py-1.5 shadow-sm">
        <Image src="/maczac.png" alt={BRAND.parent} width={663} height={161} className="h-7 w-auto" priority />
      </span>
      <span className="text-sm font-semibold text-teal-50/90">presents</span>
    </span>
  );
}

/** Footer credit: "A MACZAC product". */
export function MaczacCredit() {
  return (
    <span className="inline-flex items-center gap-2 text-slate-500">
      A product of
      <Image src="/maczac.png" alt={BRAND.parent} width={663} height={161} className="h-6 w-auto" />
    </span>
  );
}
