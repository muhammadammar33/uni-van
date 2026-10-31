import Image from "next/image";
import { BRAND } from "@/lib/brand";

/** Footer credit: "A MACZAC product". */
export function MaczacCredit() {
  return (
    <span className="inline-flex items-center gap-2 text-slate-500">
      A product of
      <Image src="/maczac.png" alt={BRAND.parent} width={663} height={161} className="h-6 w-auto" />
    </span>
  );
}
