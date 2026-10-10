import { toCsv } from "@/lib/riders";

/** Example file for the rider import, with Pakistani sample rows to overwrite. */
export function GET() {
  const csv = toCsv([
    ["Name", "Phone", "Gender", "Roll No", "Class", "Stop"],
    ["Ayesha Khan", "0300 1234567", "Female", "FA21-BCS-001", "BSCS 7A", "Saddar Chowk"],
    ["Muhammad Ahmed", "0301 7654321", "Male", "FA21-BCS-002", "BSCS 7A", "Faizabad"],
  ]);
  return new Response("﻿" + csv + "\n", {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="rider-list-template.csv"' },
  });
}
