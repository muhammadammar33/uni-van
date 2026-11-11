import "server-only";
import { randomUUID } from "node:crypto";
import { del, get, put } from "@vercel/blob";
import { logError } from "@/lib/api";

/**
 * Where encrypted ID photos live. With a Vercel Blob store connected to the project (BLOB_READ_WRITE_TOKEN),
 * they go there as private files; without one (local development), they stay in the database as before.
 * Photos are encrypted before they leave the server either way, so the store only ever holds unreadable
 * bytes: even a leaked file is useless without ID_ENCRYPTION_KEY.
 */
export const blobStoreOn = () => !!process.env.BLOB_READ_WRITE_TOKEN;

/** Private by default; set ID_BLOB_ACCESS=public only if the Blob store was created as a public store. */
const access = () => (process.env.ID_BLOB_ACCESS === "public" ? "public" : "private") as "public" | "private";

/** Saves encrypted bytes; returns the file's URL. */
export async function putDoc(encrypted: Buffer): Promise<string> {
  const r = await put(`id-docs/${randomUUID()}.bin`, encrypted, { access: access(), addRandomSuffix: true, contentType: "application/octet-stream" });
  return r.url;
}

/** Reads a stored file's encrypted bytes. */
export async function getDoc(url: string): Promise<Buffer> {
  const r = await get(url, { access: access(), useCache: false });
  if (!r || r.statusCode !== 200) throw new Error("ID photo file not found");
  return Buffer.from(await new Response(r.stream).arrayBuffer());
}

/** Deletes stored files; never throws (a leftover encrypted file is harmless, a failed request isn't). */
export async function deleteDocs(urls: (string | null | undefined)[]) {
  const list = urls.filter((u): u is string => !!u);
  if (!list.length) return;
  try {
    await del(list);
  } catch (err) {
    logError("blob delete", err);
  }
}
