"use client";

import { Portal } from "@/components/Portal";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Camera, Car, Clock, IdCard, LoaderCircle, ScanFace, ShieldCheck, X } from "lucide-react";
import { checkId, cleanIdNumber, formatIdNumber, LICENSE_AUTHORITIES, parseCnicFront, type LicenseAuthority } from "@/lib/identityRules";
import { todayLocal } from "@/lib/format";
import type { IdStatus } from "@/lib/identity";

type Mode = "rider" | "driver";
type Kind = "cnic_front" | "cnic_back" | "selfie" | "license" | "bform" | "guardian_front" | "guardian_back";
export type IdPrefill = {
  phone: string;
  phoneToken?: string;
  name?: string;
  gender?: "male" | "female" | null;
  cnic?: string;
};

const PHOTO: Record<Kind, { label: string; icon: typeof IdCard; selfie?: boolean }> = {
  cnic_front: { label: "CNIC front", icon: IdCard },
  cnic_back: { label: "CNIC back", icon: IdCard },
  license: { label: "Driving licence", icon: Car },
  selfie: { label: "Selfie", icon: ScanFace, selfie: true },
  bform: { label: "B-form", icon: IdCard },
  guardian_front: { label: "Parent's CNIC front", icon: IdCard },
  guardian_back: { label: "Parent's CNIC back", icon: IdCard },
};

/** Shrinks a camera photo (they're often 5+ MB) to a JPEG data URL the server accepts. */
async function compress(file: File, max: number): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  for (const q of [0.85, 0.75, 0.6]) {
    const url = c.toDataURL("image/jpeg", q);
    if (url.length < 1_900_000) return url;
  }
  return c.toDataURL("image/jpeg", 0.5);
}

type Box = { x: number; y: number; w: number; h: number };

/**
 * Where the card is in the photo. A card is full of print and pattern while a table or cloth around it is
 * smooth, so it's the area with the most fine detail (brightness alone fails: lighting makes cloth as
 * bright as the card). Falls back to the whole photo.
 */
function findCard(bmp: ImageBitmap): Box {
  const W = 300;
  const H = Math.max(1, Math.round((W * bmp.height) / bmp.width));
  // Shrink by halves: one big jump makes cloth texture look like detail (aliasing).
  let src: CanvasImageSource = bmp;
  let sw = bmp.width;
  let sh = bmp.height;
  while (sw / 2 > W) {
    const half = document.createElement("canvas");
    half.width = Math.round(sw / 2);
    half.height = Math.round(sh / 2);
    const hctx = half.getContext("2d")!;
    hctx.imageSmoothingQuality = "high";
    hctx.drawImage(src, 0, 0, half.width, half.height);
    [src, sw, sh] = [half, half.width, half.height];
  }
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, W, H);
  const px = ctx.getImageData(0, 0, W, H).data;
  const g = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) g[i] = px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114;
  // Integral images of g and g², for the spread of brightness in every 5×5 square.
  const S = new Float64Array((W + 1) * (H + 1));
  const Q = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = g[y * W + x];
      const i = (y + 1) * (W + 1) + x + 1;
      S[i] = v + S[i - 1] + S[i - W - 1] - S[i - W - 2];
      Q[i] = v * v + Q[i - 1] + Q[i - W - 1] - Q[i - W - 2];
    }
  const rowHits = new Array(H).fill(0);
  const colHits = new Array(W).fill(0);
  for (let y = 2; y < H - 2; y++)
    for (let x = 2; x < W - 2; x++) {
      const a = (y - 2) * (W + 1) + (x - 2);
      const b = (y + 3) * (W + 1) + (x + 3);
      const c2 = (y - 2) * (W + 1) + (x + 3);
      const d = (y + 3) * (W + 1) + (x - 2);
      const sum = S[b] - S[c2] - S[d] + S[a];
      const sq = Q[b] - Q[c2] - Q[d] + Q[a];
      const sd = Math.sqrt(Math.max(0, sq / 25 - (sum / 25) ** 2));
      if (sd > 10) {
        rowHits[y]++;
        colHits[x]++;
      }
    }
  const rows = rowHits.flatMap((n, y) => (n / W > 0.12 ? [y] : []));
  const cols = colHits.flatMap((n, x) => (n / H > 0.12 ? [x] : []));
  const whole = { x: 0, y: 0, w: bmp.width, h: bmp.height };
  if (rows.length < H * 0.15 || cols.length < W * 0.15) return whole;
  const k = bmp.width / W;
  const pad = 8;
  const x0 = Math.max(0, (cols[0] - pad) * k);
  const y0 = Math.max(0, (rows[0] - pad) * k);
  const x1 = Math.min(bmp.width, (cols[cols.length - 1] + pad) * k);
  const y1 = Math.min(bmp.height, (rows[rows.length - 1] + pad) * k);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * The card made easy to read: cropped, turned by `deg` (90, 180, 270) for cards photographed sideways or
 * upside down, about 1600 pixels across, in grey with the contrast stretched (the green pattern fades).
 */
function prepare(bmp: ImageBitmap, box: Box, deg: number): HTMLCanvasElement {
  const side = deg % 180 !== 0;
  const scale = Math.min(2, 1600 / Math.max(box.w, box.h));
  const w = Math.round(box.w * scale);
  const h = Math.round(box.h * scale);
  const c = document.createElement("canvas");
  c.width = side ? h : w;
  c.height = side ? w : h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(bmp, box.x, box.y, box.w, box.h, -w / 2, -h / 2, w, h);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const px = img.data;
  const hist = new Array(256).fill(0);
  for (let p = 0; p < px.length; p += 4) {
    const v = Math.round(px[p] * 0.299 + px[p + 1] * 0.587 + px[p + 2] * 0.114);
    px[p] = v;
    hist[v]++;
  }
  // Stretch so the darkest and lightest 2% become black and white.
  const cut = (px.length / 4) * 0.02;
  let lo = 0;
  let hi = 255;
  for (let n = 0; lo < 255 && (n += hist[lo]) < cut; ) lo++;
  for (let n = 0; hi > 0 && (n += hist[hi]) < cut; ) hi--;
  const range = Math.max(1, hi - lo);
  for (let p = 0; p < px.length; p += 4) px[p] = px[p + 1] = px[p + 2] = Math.max(0, Math.min(255, ((px[p] - lo) * 255) / range));
  ctx.putImageData(img, 0, 0);
  return c;
}

/** How much a reading found: the number and dates count most. */
const score = (r: ReturnType<typeof parseCnicFront>) => (r.idNumber ? 3 : 0) + (r.dob ? 2 : 0) + (r.expiry ? 1 : 0) + (r.name ? 1 : 0) + (r.gender ? 1 : 0);

/**
 * Reads the English side of a CNIC on the phone itself (nothing is sent anywhere for this), from the
 * original photo: finds the card, crops it, and tries it both ways round. The reader's files come from
 * this site (public/ocr), not a CDN that might be blocked. Gives up after 45 seconds: reading is only a help.
 */
async function readCard(file: File, onProgress: (pct: number) => void) {
  const { createWorker } = await import("tesseract.js");
  const base = `${window.location.origin}/ocr/5.1.1`;
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error("timeout")), 45000)));
  try {
    return await Promise.race([
      (async () => {
        // For checking the reader on a phone: localStorage["hamsafar:ocr-debug"] = "1" logs timings and text.
        const debug = (() => {
          try {
            return localStorage.getItem("hamsafar:ocr-debug") === "1";
          } catch {
            return false;
          }
        })();
        const t0 = performance.now();
        const log = (...a: unknown[]) => debug && console.log(`[ocr ${Math.round(performance.now() - t0)}ms]`, ...a);
        const bmp = await createImageBitmap(file);
        const box = findCard(bmp);
        log("photo", bmp.width, bmp.height, "card", box);
        worker = await createWorker("eng", 1, {
          workerPath: `${base}/worker.min.js`,
          corePath: base,
          langPath: base,
          logger: (m: { status: string; progress: number }) => {
            // Loading the reader is the first part, then each way round the card is tried.
            if (m.status !== "recognizing text") onProgress(Math.round(Math.min(29, m.progress * 29)));
          },
        });
        // A card is wider than tall: a tall card was photographed sideways.
        const turns = box.h > box.w ? [270, 90] : [0, 180];
        let best: ReturnType<typeof parseCnicFront> | null = null;
        let bestTurn = turns[0];
        for (const [i, deg] of turns.entries()) {
          onProgress(30 + i * 30);
          const canvas = prepare(bmp, box, deg);
          log("turn", deg, canvas.width, canvas.height);
          const { data } = await worker.recognize(canvas);
          const r = parseCnicFront(data.text);
          log("read", deg, JSON.stringify(r), data.text);
          if (!best || score(r) > score(best)) [best, bestTurn] = [r, deg];
          if (best.idNumber && best.dob) break;
        }
        // Still no number or birth date: once more the best way round, looking for scattered words instead of lines.
        if (!best!.idNumber || !best!.dob) {
          onProgress(90);
          await worker.setParameters({ tessedit_pageseg_mode: "11" as never });
          const { data } = await worker.recognize(prepare(bmp, box, bestTurn));
          const r = parseCnicFront(data.text);
          best = { ...r, ...Object.fromEntries(Object.entries(best!).filter(([, v]) => v)) } as typeof r;
        }
        bmp.close();
        return best!;
      })(),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
    void (worker as Awaited<ReturnType<typeof createWorker>> | null)?.terminate().catch(() => {});
  }
}

/**
 * `ensure(role, prefill)` opens the one-time ID check and resolves with the new status (or null if closed).
 * Render `dialog`.
 */
export function useIdVerify() {
  const [open, setOpen] = useState<{
    role: Mode;
    prefill: IdPrefill;
    status?: IdStatus;
    resolve: (s: IdStatus | null) => void;
  } | null>(null);
  const ensure = useCallback((role: Mode, prefill: IdPrefill, status?: IdStatus) => new Promise<IdStatus | null>((resolve) => setOpen({ role, prefill, status, resolve })), []);
  const dialog = open ? (
    <IdDialog
      role={open.role}
      prefill={open.prefill}
      status={open.status}
      onDone={(s) => {
        open.resolve(s);
        setOpen(null);
      }}
    />
  ) : null;
  return { ensure, dialog };
}

/** Expected-by time for a check sent at `iso`: 24 hours later. */
export const verifyBy = (iso: string) =>
  new Date(new Date(iso).getTime() + 24 * 3600_000).toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

function IdDialog({ role, prefill, status, onDone }: { role: Mode; prefill: IdPrefill; status?: IdStatus; onDone: (s: IdStatus | null) => void }) {
  // A rider (CNIC) who's verified or waiting only adds the licence to drive.
  const upgrade = role === "driver" && !!status && status.idType === "cnic" && (status.riderStatus === "approved" || status.riderStatus === "pending");
  const [idType, setIdType] = useState<"cnic" | "bform">("cnic");
  const [photos, setPhotos] = useState<Partial<Record<Kind, string>>>({});
  const [reading, setReading] = useState(false);
  const [readPct, setReadPct] = useState(0);
  const [readFailed, setReadFailed] = useState(false);
  const [scanned, setScanned] = useState<{
    idNumber: string | null;
    name: string | null;
  } | null>(null);
  const [f, setF] = useState({
    fullName: prefill.name ?? "",
    fatherName: "",
    idNumber: prefill.cnic ? formatIdNumber(cleanIdNumber(prefill.cnic) ?? prefill.cnic) : "",
    gender: (prefill.gender ?? null) as "male" | "female" | null,
    dob: "",
    idExpiry: "",
    lifetime: false,
    guardianName: "",
    guardianCnic: "",
    guardianRelation: "Father",
    licenseNumber: "",
    licenseAuthority: "" as LicenseAuthority | "",
    licenseExpiry: "",
    vehicleReg: "",
  });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<IdStatus | null>(null);
  const set = (p: Partial<typeof f>) => setF((cur) => ({ ...cur, ...p }));

  const kinds: Kind[] = upgrade
    ? ["license"]
    : idType === "cnic"
      ? ["cnic_front", "cnic_back", ...(role === "driver" ? (["license"] as const) : []), "selfie"]
      : ["bform", "guardian_front", "guardian_back", "selfie"];

  async function onPhoto(kind: Kind, file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const url = await compress(file, PHOTO[kind].selfie ? 900 : 1600);
      setPhotos((p) => ({ ...p, [kind]: url }));
      if (kind === "cnic_front") {
        setReading(true);
        setReadPct(0);
        setReadFailed(false);
        try {
          const r = await readCard(file, setReadPct);
          if (!r.idNumber && !r.dob) setReadFailed(true);
          setScanned({ idNumber: r.idNumber, name: r.name });
          // Fill only what's still empty: what the person typed wins.
          setF((cur) => ({
            ...cur,
            idNumber: cur.idNumber || (r.idNumber ? formatIdNumber(r.idNumber) : ""),
            fullName: cur.fullName || r.name || "",
            fatherName: cur.fatherName || r.fatherName || "",
            gender: cur.gender ?? r.gender,
            dob: cur.dob || r.dob || "",
            idExpiry: cur.idExpiry || r.expiry || "",
          }));
        } catch {
          // Reading is only a help: the person types the details instead.
          setReadFailed(true);
        } finally {
          setReading(false);
        }
      }
    } catch {
      setError("Couldn't open that photo. Please try again.");
    }
  }

  const today = todayLocal();
  const problems = upgrade
    ? []
    : checkId(
        {
          mode: role,
          idType,
          idNumber: f.idNumber,
          gender: f.gender ?? "male",
          dob: f.dob,
          idExpiry: idType === "cnic" ? (f.lifetime ? "lifetime" : f.idExpiry) : null,
          guardianCnic: f.guardianCnic,
          licenseExpiry: f.licenseExpiry,
        },
        today,
      ).errors;
  const missing = kinds.filter((k) => !photos[k]);
  const driverMissing = role === "driver" && (!f.licenseNumber.trim() || !f.licenseAuthority || !f.licenseExpiry || !f.vehicleReg.trim());
  const ready = !missing.length && consent && !driverMissing && (upgrade || (!problems.length && !!f.gender && f.fullName.trim().length >= 3));

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/identity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: role,
          phone: prefill.phone,
          phoneToken: prefill.phoneToken,
          idType,
          idNumber: f.idNumber,
          fullName: f.fullName,
          fatherName: f.fatherName,
          gender: f.gender,
          dob: f.dob,
          idExpiry: idType === "cnic" ? (f.lifetime ? "2099-12-31" : f.idExpiry) : "",
          guardian:
            idType === "bform"
              ? {
                  name: f.guardianName,
                  cnic: f.guardianCnic,
                  relation: f.guardianRelation,
                }
              : undefined,
          license:
            role === "driver"
              ? {
                  number: f.licenseNumber,
                  expiry: f.licenseExpiry,
                  authority: f.licenseAuthority,
                }
              : undefined,
          vehicleReg: f.vehicleReg,
          consent: true,
          scanned: scanned ?? undefined,
          photos,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Couldn't send. Please try again.");
      setDone(json.status);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <Sheet onClose={() => onDone(done)} title="Thank you!">
        <div className="space-y-4 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
            <Clock className="size-7" />
          </span>
          <p className="text-slate-700">
            We&apos;re checking your ID. It takes <b>up to 24 hours</b>
            {done.submittedAt ? ` (by ${verifyBy(done.submittedAt)})` : ""}.
          </p>
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            {role === "driver" ? "Your ride is saved and goes live by itself as soon as you're approved." : "You can book now. If anything's wrong with your ID, we'll let you know."}
          </p>
          <button type="button" className="btn-primary w-full py-3" onClick={() => onDone(done)}>
            Continue
          </button>
        </div>
      </Sheet>
    );

  return (
    <Sheet onClose={() => onDone(null)} title={upgrade ? "Add your driving licence" : role === "driver" ? "Verify your ID to drive" : "Verify your ID"}>
      <div className="space-y-5">
        <p className="flex items-start gap-2 rounded-xl bg-brand-lt/50 p-3 text-sm text-slate-700">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" />
          <span>
            {upgrade
              ? "Your ID is already with us. Add your licence and car to offer rides."
              : "Once only, so everyone on Hamsafar is a real, known person. Only the Hamsafar team sees your ID, never drivers or riders."}
          </span>
        </p>

        {role === "rider" && !upgrade && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            {(["cnic", "bform"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={idType === t}
                onClick={() => {
                  setIdType(t);
                  setPhotos({});
                }}
                className={`rounded-xl border-2 py-2 font-semibold ${idType === t ? "border-brand bg-brand-lt/50 text-brand" : "border-slate-200 text-slate-600"}`}
              >
                {t === "cnic" ? "I have a CNIC" : "Under 18 (B-form)"}
              </button>
            ))}
          </div>
        )}

        <div>
          <span className="label">Photos</span>
          <div className="grid grid-cols-2 gap-2">
            {kinds.map((k) => (
              <PhotoTile key={k} kind={k} value={photos[k]} busy={k === "cnic_front" && reading} onFile={(file) => onPhoto(k, file)} />
            ))}
          </div>
          {reading && (
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
              <LoaderCircle className="size-4 animate-spin" /> Reading your card… {readPct > 0 && `${readPct}%`}
              <span className="text-xs">(you can type the details meanwhile)</span>
            </p>
          )}
          {!reading && readFailed && <p className="mt-2 text-sm text-amber-800">Couldn&apos;t read the card from the photo. Please type the details below.</p>}
        </div>

        {!upgrade && (
          <div className="space-y-3">
            <span className="label">{idType === "cnic" ? "Your details (check them)" : "Child's details (from the B-form)"}</span>
            <Field id="id-name" label="Full name, as on the card" value={f.fullName} onChange={(v) => set({ fullName: v })} />
            {idType === "cnic" && <Field id="id-father" label="Father's / husband's name" value={f.fatherName} onChange={(v) => set({ fatherName: v })} />}
            <Field
              id="id-number"
              label={idType === "cnic" ? "CNIC number" : "B-form number"}
              value={f.idNumber}
              inputMode="numeric"
              placeholder="12345-1234567-1"
              onChange={(v) => set({ idNumber: v })}
              onBlur={() => {
                const c = cleanIdNumber(f.idNumber);
                if (c) set({ idNumber: formatIdNumber(c) });
              }}
            />
            <div className="grid grid-cols-2 gap-2">
              {(["female", "male"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={f.gender === g}
                  onClick={() => set({ gender: g })}
                  className={`rounded-xl border-2 py-2 font-semibold ${f.gender === g ? (g === "female" ? "border-female bg-female-lt text-female" : "border-male bg-male-lt text-male") : "border-slate-200 text-slate-600"}`}
                >
                  {g === "female" ? "Female" : "Male"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field id="id-dob" label="Date of birth" type="date" value={f.dob} onChange={(v) => set({ dob: v })} />
              {idType === "cnic" && (
                <div>
                  <Field id="id-expiry" label="CNIC expiry" type="date" value={f.lifetime ? "" : f.idExpiry} disabled={f.lifetime} onChange={(v) => set({ idExpiry: v })} />
                  <label className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                    <input type="checkbox" checked={f.lifetime} onChange={(e) => set({ lifetime: e.target.checked })} /> Lifetime card
                  </label>
                </div>
              )}
            </div>
            {idType === "bform" && (
              <div className="space-y-3 rounded-xl bg-slate-50 p-3">
                <span className="label">Parent / guardian</span>
                <Field id="id-g-name" label="Parent's name" value={f.guardianName} onChange={(v) => set({ guardianName: v })} />
                <Field id="id-g-cnic" label="Parent's CNIC number" inputMode="numeric" placeholder="12345-1234567-1" value={f.guardianCnic} onChange={(v) => set({ guardianCnic: v })} />
                <select aria-label="Relation" className="input" value={f.guardianRelation} onChange={(e) => set({ guardianRelation: e.target.value })}>
                  {["Father", "Mother", "Guardian"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {role === "driver" && (
          <div className="space-y-3">
            <span className="label">Licence &amp; car</span>
            <Field id="lic-number" label="Driving licence number" value={f.licenseNumber} onChange={(v) => set({ licenseNumber: v })} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor="lic-authority">
                  Issued by
                </label>
                <select
                  id="lic-authority"
                  className="input"
                  value={f.licenseAuthority}
                  onChange={(e) =>
                    set({
                      licenseAuthority: e.target.value as LicenseAuthority,
                    })
                  }
                >
                  <option value="">Choose…</option>
                  {Object.entries(LICENSE_AUTHORITIES).map(([k, a]) => (
                    <option key={k} value={k}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <Field id="lic-expiry" label="Licence expiry" type="date" value={f.licenseExpiry} onChange={(v) => set({ licenseExpiry: v })} />
            </div>
            <Field id="car-reg" label="Car registration number" placeholder="e.g. LEA-2207 or ICT ABC-123" value={f.vehicleReg} onChange={(v) => set({ vehicleReg: v.toUpperCase() })} />
          </div>
        )}

        {!upgrade && f.idNumber && problems.length > 0 && <p className="text-sm text-amber-800">{problems[0]}</p>}

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            I agree to the{" "}
            <Link href="/terms" target="_blank" className="font-semibold text-brand underline">
              terms of use
            </Link>
            , and that Hamsafar checks and keeps my ID to keep rides safe, as explained in the{" "}
            <Link href="/privacy" target="_blank" className="font-semibold text-brand underline">
              privacy page
            </Link>
            .
          </span>
        </label>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
            {error}
          </p>
        )}
        <button type="button" className="btn-primary w-full py-3.5 text-base" disabled={!ready || busy} onClick={submit}>
          {busy ? "Sending…" : missing.length ? `Add ${missing.length} more photo${missing.length > 1 ? "s" : ""}` : "Send for checking"}
        </button>
        <p className="text-center text-xs text-slate-500">Checked by the Hamsafar team within 24 hours.</p>
      </div>
    </Sheet>
  );
}

function PhotoTile({ kind, value, busy, onFile }: { kind: Kind; value?: string; busy?: boolean; onFile: (f: File | undefined) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const { label, icon: Icon, selfie } = PHOTO[kind];
  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        aria-label={`${value ? "Retake" : "Take"} photo: ${label}`}
        className={`relative flex h-28 flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border-2 border-dashed text-sm font-semibold ${value ? "border-emerald-400" : "border-slate-300 text-slate-600 hover:border-brand"}`}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- a local preview */}
            <img src={value} alt="" className="absolute inset-0 size-full object-cover opacity-80" />
            <span className="relative flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs text-emerald-700">
              {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <BadgeCheck className="size-3.5" />} {label}
            </span>
          </>
        ) : (
          <>
            <span className="relative">
              <Icon className="size-7 text-brand" />
              <Camera className="absolute -bottom-1 -right-2 size-4 rounded-full bg-white text-slate-500" />
            </span>
            {label}
          </>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture={selfie ? "user" : "environment"}
        className="hidden"
        data-kind={kind}
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  placeholder,
  inputMode,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  placeholder?: string;
  inputMode?: "numeric" | "text";
  disabled?: boolean;
}) {
  return (
    <div className="min-w-0">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input id={id} type={type} className="input" value={value} placeholder={placeholder} inputMode={inputMode} disabled={disabled} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center sm:p-4">
        <div role="dialog" aria-modal="true" aria-labelledby="idv-title" className="flex max-h-[92dvh] w-full max-w-md animate-rise flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
          <div className="flex items-center gap-3 border-b border-slate-100 p-4">
            <h2 id="idv-title" className="flex-1 text-lg font-extrabold">
              {title}
            </h2>
            <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto p-4">{children}</div>
        </div>
      </div>
    </Portal>
  );
}
