/**
 * The Hamsafar mark: a map pin holding two travellers side by side ("ham" = together, "safar" = journey).
 * Plain SVG so it can be used in React, the favicon and link-preview images alike.
 */
export const MARK_PIN = "M32 57C26.05 46.15 15 38.75 15 26A17 17 0 0 1 49 26C49 38.75 37.95 46.15 32 57Z";

export function markSvg({ id = "hm", rounded = true, padding = 0 }: { id?: string; rounded?: boolean; padding?: number } = {}) {
  const s = 1 - padding * 2;
  const t = 32 * padding * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14b8a6"/><stop offset=".55" stop-color="#0f766e"/><stop offset="1" stop-color="#134e4a"/></linearGradient></defs>
<rect width="64" height="64" rx="${rounded ? 16 : 0}" fill="url(#${id})"/>
<g transform="translate(${t} ${t}) scale(${s})">
<path d="${MARK_PIN}" fill="#fff"/>
<circle cx="25.5" cy="21.5" r="4.2" fill="#0f766e"/><path d="M18.3 34.5a7.2 7.2 0 0 1 14.4 0z" fill="#0f766e"/>
<circle cx="38.5" cy="21.5" r="4.2" fill="#f59e0b" stroke="#fff" stroke-width="1.4" paint-order="stroke"/><path d="M31.3 34.5a7.2 7.2 0 0 1 14.4 0z" fill="#f59e0b" stroke="#fff" stroke-width="1.4" paint-order="stroke"/>
</g></svg>`;
}
