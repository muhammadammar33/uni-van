"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { CircleAlert, CircleCheckBig, Download, FileSpreadsheet, Upload } from "lucide-react";
import { importRiders, saveRider, type FormState, type ImportResult } from "@/app/admin/actions";
import { keepFields } from "@/lib/keepFields";
import { parseCsv, readRiderRows } from "@/lib/riders";

type Labels = { rider: string; riders: string; refLabel: string; groupLabel: string };
export type RiderInitial = { id: number; name: string; phone: string; gender: "male" | "female"; refNo: string; groupName: string; stop: string };

export function RiderForm({ labels, initial, onDone }: { labels: Labels; initial?: RiderInitial; onDone?: () => void }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const res = await saveRider(initial?.id ?? null, prev, form);
    if (res?.ok && !initial) ref.current?.reset();
    if (res?.ok) onDone?.();
    return res;
  }, undefined);
  return (
    <form ref={ref} onSubmit={keepFields(action)} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="name" required placeholder="Full name" className="input" defaultValue={initial?.name} aria-label="Full name" />
        <input name="phone" required type="tel" placeholder="Phone, e.g. 0300 1234567" className="input" defaultValue={initial?.phone} aria-label="Phone" />
        <select name="gender" required className="input" defaultValue={initial?.gender ?? ""} aria-label="Gender">
          <option value="" disabled>
            Gender…
          </option>
          <option value="female">Female</option>
          <option value="male">Male</option>
        </select>
        <input name="refNo" placeholder={`${labels.refLabel} (optional)`} className="input" defaultValue={initial?.refNo} aria-label={labels.refLabel} />
        <input name="groupName" placeholder={`${labels.groupLabel} (optional)`} className="input" defaultValue={initial?.groupName} aria-label={labels.groupLabel} />
        <input name="stop" placeholder="Usual stop (optional)" className="input" defaultValue={initial?.stop} aria-label="Usual stop" />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
      <button className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : initial ? "Save changes" : `Add ${labels.rider}`}
      </button>
    </form>
  );
}

async function readFile(file: File): Promise<unknown[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { default: readXlsxFile } = await import("read-excel-file");
    return (await readXlsxFile(file)) as unknown[][];
  }
  if (/\.xls$/i.test(file.name)) throw new Error("Old .xls files aren't supported. In Excel choose File → Save As → Excel Workbook (.xlsx) or CSV.");
  return parseCsv(await file.text());
}

export function RiderImport({ labels }: { labels: Labels }) {
  const [table, setTable] = useState<unknown[][] | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const preview = table ? readRiderRows(table) : null;

  const pick = async (file: File | undefined) => {
    setError(null);
    setResult(null);
    setTable(null);
    if (!file) return;
    setFileName(file.name);
    try {
      setTable(await readFile(file));
    } catch (e) {
      setError((e as Error).message || "Couldn't read that file.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={() => input.current?.click()}>
          <Upload className="size-4" /> Choose Excel or CSV file
        </button>
        <a href="/admin/riders/template.csv" className="btn-ghost">
          <Download className="size-4" /> Download template
        </a>
        <input ref={input} type="file" accept=".csv,.xlsx,.xls,text/csv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
        <p className="font-semibold text-slate-700">How the file should look</p>
        <p className="mt-1">
          First row: column names. Needed: <b>Name</b>, <b>Phone</b>, <b>Gender</b> (Male / Female, or M / F). Optional: <b>{labels.refLabel}</b>,{" "}
          <b>{labels.groupLabel}</b>, <b>Stop</b>. Common names like &ldquo;Mobile No&rdquo;, &ldquo;Sex&rdquo; or &ldquo;Roll Number&rdquo; are understood.
        </p>
        <p className="mt-1">
          {labels.riders.replace(/^./, (c) => c.toUpperCase())} already on the list (same phone) are updated, new ones are added, nobody is deleted.
        </p>
      </div>

      {error && (
        <p className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <CircleAlert className="size-4 shrink-0" /> {error}
        </p>
      )}

      {preview && !result && (
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center gap-2 font-semibold">
            <FileSpreadsheet className="size-5 text-brand" /> {fileName}
          </div>
          {preview.missing.length ? (
            <p className="text-sm text-red-700">
              Missing column{preview.missing.length > 1 ? "s" : ""}: <b>{preview.missing.join(", ")}</b>. Check the first row of the file, or start from the template.
            </p>
          ) : (
            <>
              <p className="text-sm">
                <b className="text-emerald-700">{preview.riders.length}</b> {labels.riders} ready to import
                {preview.problems.length > 0 && (
                  <>
                    , <b className="text-amber-700">{preview.problems.length}</b> row{preview.problems.length > 1 ? "s" : ""} will be skipped
                  </>
                )}
                .
              </p>
              {preview.riders.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="py-1 pr-3">Name</th>
                        <th className="py-1 pr-3">Phone</th>
                        <th className="py-1 pr-3">Gender</th>
                        <th className="py-1 pr-3">{labels.refLabel}</th>
                        <th className="py-1">{labels.groupLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.riders.slice(0, 5).map((r) => (
                        <tr key={r.phone} className="border-t border-slate-100">
                          <td className="py-1 pr-3">{r.name}</td>
                          <td className="py-1 pr-3">{r.phone}</td>
                          <td className="py-1 pr-3">{r.gender}</td>
                          <td className="py-1 pr-3">{r.refNo}</td>
                          <td className="py-1">{r.groupName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.riders.length > 5 && <p className="mt-1 text-xs text-slate-400">…and {preview.riders.length - 5} more</p>}
                </div>
              )}
              <ProblemList problems={preview.problems} />
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={pending || preview.riders.length === 0}
                  onClick={() => start(async () => setResult(await importRiders(table!)))}
                >
                  {pending ? "Importing…" : `Import ${preview.riders.length} ${labels.riders}`}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setTable(null)}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {result && "error" in result && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{result.error}</p>}
      {result && !("error" in result) && (
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="flex items-center gap-2 font-semibold">
            <CircleCheckBig className="size-5" /> Done: {result.added} added, {result.updated} updated
            {result.problems.length ? `, ${result.problems.length} skipped` : ""}.
          </p>
          <ProblemList problems={result.problems} />
        </div>
      )}
    </div>
  );
}

function ProblemList({ problems }: { problems: { row: number; message: string }[] }) {
  if (!problems.length) return null;
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer font-medium text-amber-800">Rows that will be skipped ({problems.length})</summary>
      <ul className="mt-2 max-h-48 space-y-0.5 overflow-auto text-xs text-slate-600">
        {problems.map((p) => (
          <li key={p.row}>
            Row {p.row}: {p.message}
          </li>
        ))}
      </ul>
    </details>
  );
}
