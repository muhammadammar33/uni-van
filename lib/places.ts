/**
 * Common pickup / drop-off points from Wah Cantt to Rawat (GT Road corridor, Islamabad, Rawalpindi).
 * Coordinates are approximate (good to a few hundred metres); anyone can drop a custom pin on the map instead.
 */
export type Place = { key: string; name: string; area: string; lat: number; lng: number };

export const AREAS = [
  "Wah & Taxila",
  "GT Road & Motorway",
  "Islamabad – sectors",
  "Islamabad – landmarks & universities",
  "Rawalpindi",
  "Expressway, Bahria & Rawat",
] as const;

const P = (area: (typeof AREAS)[number], key: string, name: string, lat: number, lng: number): Place => ({ key, name, area, lat, lng });

export const PLACES: Place[] = [
  // Wah & Taxila
  P("Wah & Taxila", "hassan-abdal", "Hassan Abdal", 33.8195, 72.689),
  P("Wah & Taxila", "wah-lalarukh", "Lalarukh, Wah Cantt", 33.796, 72.711),
  P("Wah & Taxila", "wah-cantt", "Wah Cantt (Mall Road)", 33.7915, 72.723),
  P("Wah & Taxila", "wah-pof", "POF Hospital, Wah", 33.788, 72.736),
  P("Wah & Taxila", "wah-gt-road", "Wah GT Road (Basti)", 33.778, 72.745),
  P("Wah & Taxila", "comsats-wah", "COMSATS Wah", 33.7527, 72.7875),
  P("Wah & Taxila", "new-city-wah", "New City, Wah", 33.761, 72.769),
  P("Wah & Taxila", "uet-taxila", "UET Taxila", 33.768, 72.827),
  P("Wah & Taxila", "taxila-museum", "Taxila Museum", 33.7505, 72.8226),
  P("Wah & Taxila", "taxila-chowk", "Taxila Chowk", 33.7455, 72.836),
  P("Wah & Taxila", "hit-taxila", "HIT / HITEC University, Taxila", 33.758, 72.864),

  // GT Road & Motorway
  P("GT Road & Motorway", "sangjani", "Sangjani Toll Plaza", 33.693, 72.858),
  P("GT Road & Motorway", "b17", "B-17 (Multi Gardens)", 33.687, 72.843),
  P("GT Road & Motorway", "tarnol", "Tarnol", 33.664, 72.905),
  P("GT Road & Motorway", "golra-mor", "Golra Mor", 33.677, 72.989),
  P("GT Road & Motorway", "26-number", "26 Number Chungi", 33.6905, 72.9575),
  P("GT Road & Motorway", "islamabad-airport", "Islamabad International Airport", 33.549, 72.826),

  // Islamabad sectors
  P("Islamabad – sectors", "d12", "D-12 Markaz", 33.704, 72.958),
  P("Islamabad – sectors", "e11", "E-11 Markaz", 33.6995, 72.977),
  P("Islamabad – sectors", "f11", "F-11 Markaz", 33.6845, 72.988),
  P("Islamabad – sectors", "f10", "F-10 Markaz", 33.6955, 73.013),
  P("Islamabad – sectors", "f8", "F-8 Markaz", 33.709, 73.038),
  P("Islamabad – sectors", "f7", "F-7 Markaz (Jinnah Super)", 33.7215, 73.056),
  P("Islamabad – sectors", "f6", "F-6 Markaz (Super Market)", 33.729, 73.075),
  P("Islamabad – sectors", "g6", "G-6 (Aabpara)", 33.7065, 73.085),
  P("Islamabad – sectors", "g7", "G-7 (Sitara Market)", 33.7, 73.07),
  P("Islamabad – sectors", "g8", "G-8 Markaz", 33.695, 73.052),
  P("Islamabad – sectors", "g9", "G-9 Markaz (Karachi Company)", 33.687, 73.033),
  P("Islamabad – sectors", "g10", "G-10 Markaz", 33.675, 73.014),
  P("Islamabad – sectors", "g11", "G-11 Markaz", 33.668, 72.996),
  P("Islamabad – sectors", "g13", "G-13 Markaz", 33.651, 72.968),
  P("Islamabad – sectors", "g14", "G-14", 33.638, 72.951),
  P("Islamabad – sectors", "h8", "H-8", 33.68, 73.065),
  P("Islamabad – sectors", "i8", "I-8 Markaz", 33.668, 73.077),
  P("Islamabad – sectors", "i9", "I-9 Markaz", 33.6597, 73.0636),
  P("Islamabad – sectors", "i10", "I-10 Markaz", 33.648, 73.04),
  P("Islamabad – sectors", "i14", "I-14 (Riphah)", 33.637, 72.995),

  // Islamabad landmarks & universities
  P("Islamabad – landmarks & universities", "blue-area", "Blue Area (Jinnah Avenue)", 33.71, 73.06),
  P("Islamabad – landmarks & universities", "zero-point", "Zero Point", 33.6925, 73.0565),
  P("Islamabad – landmarks & universities", "peshawar-mor", "Peshawar Mor", 33.667, 73.026),
  P("Islamabad – landmarks & universities", "secretariat", "Pak Secretariat", 33.733, 73.096),
  P("Islamabad – landmarks & universities", "faisal-mosque", "Faisal Mosque", 33.7295, 73.037),
  P("Islamabad – landmarks & universities", "centaurus", "Centaurus Mall", 33.7077, 73.0503),
  P("Islamabad – landmarks & universities", "pims", "PIMS Hospital", 33.702, 73.047),
  P("Islamabad – landmarks & universities", "nust", "NUST (H-12)", 33.6425, 72.99),
  P("Islamabad – landmarks & universities", "fast-isb", "FAST University (H-11)", 33.656, 72.986),
  P("Islamabad – landmarks & universities", "iiui", "International Islamic University (H-10)", 33.66, 73.029),
  P("Islamabad – landmarks & universities", "numl", "NUML (H-9)", 33.663, 73.055),
  P("Islamabad – landmarks & universities", "air-uni", "Air University (E-9)", 33.714, 73.024),
  P("Islamabad – landmarks & universities", "bahria-uni-e8", "Bahria University (E-8)", 33.717, 73.035),
  P("Islamabad – landmarks & universities", "qau", "Quaid-i-Azam University", 33.747, 73.138),
  P("Islamabad – landmarks & universities", "comsats-isb", "COMSATS Islamabad (Park Road)", 33.652, 73.157),
  P("Islamabad – landmarks & universities", "faizabad", "Faizabad", 33.661, 73.084),

  // Rawalpindi
  P("Rawalpindi", "shamsabad", "Shamsabad", 33.644, 73.078),
  P("Rawalpindi", "6th-road", "6th Road", 33.634, 73.073),
  P("Rawalpindi", "rehmanabad", "Rehmanabad", 33.638, 73.0745),
  P("Rawalpindi", "chandni-chowk", "Chandni Chowk", 33.627, 73.071),
  P("Rawalpindi", "committee-chowk", "Committee Chowk", 33.618, 73.065),
  P("Rawalpindi", "liaquat-bagh", "Liaquat Bagh", 33.61, 73.059),
  P("Rawalpindi", "raja-bazaar", "Raja Bazaar", 33.617, 73.053),
  P("Rawalpindi", "pirwadhai", "Pirwadhai", 33.625, 73.035),
  P("Rawalpindi", "saddar-rwp", "Saddar, Rawalpindi", 33.598, 73.047),
  P("Rawalpindi", "kachehri", "Kachehri Chowk", 33.597, 73.061),
  P("Rawalpindi", "chaklala-3", "Chaklala Scheme III", 33.588, 73.087),
  P("Rawalpindi", "westridge", "Westridge", 33.6, 73.02),
  P("Rawalpindi", "tench-bhatta", "Tench Bhatta", 33.579, 73.048),
  P("Rawalpindi", "adiala-road", "Adiala Road", 33.563, 73.03),
  P("Rawalpindi", "dhok-kala-khan", "Dhok Kala Khan", 33.639, 73.088),

  // Expressway, Bahria & Rawat
  P("Expressway, Bahria & Rawat", "khanna-pul", "Khanna Pul", 33.629, 73.105),
  P("Expressway, Bahria & Rawat", "koral-chowk", "Koral Chowk", 33.628, 73.144),
  P("Expressway, Bahria & Rawat", "gulberg-greens", "Gulberg Greens", 33.6, 73.165),
  P("Expressway, Bahria & Rawat", "pwd", "PWD Housing Society", 33.579, 73.139),
  P("Expressway, Bahria & Rawat", "gulraiz", "Gulraiz", 33.574, 73.122),
  P("Expressway, Bahria & Rawat", "media-town", "Media Town", 33.564, 73.117),
  P("Expressway, Bahria & Rawat", "bahria-civic", "Bahria Town Civic Center", 33.523, 73.095),
  P("Expressway, Bahria & Rawat", "bahria-ph7", "Bahria Town Phase 7", 33.526, 73.11),
  P("Expressway, Bahria & Rawat", "bahria-ph8", "Bahria Town Phase 8", 33.495, 73.088),
  P("Expressway, Bahria & Rawat", "dha-2", "DHA Phase 2 Islamabad", 33.53, 73.159),
  P("Expressway, Bahria & Rawat", "lohi-bher", "Lohi Bher", 33.574, 73.163),
  P("Expressway, Bahria & Rawat", "sihala", "Sihala", 33.547, 73.183),
  P("Expressway, Bahria & Rawat", "rawat", "Rawat (GT Road)", 33.4955, 73.193),
];

export const findPlace = (key: string | null | undefined) => (key ? PLACES.find((p) => p.key === key) : undefined);

/** A place someone picked: from the list (has key) or a custom pin. */
export type Point = { name: string; lat: number; lng: number; key?: string };

/** Readable "lat,lng|name" form for URLs, or a place key. */
export function encodePoint(p: Point): string {
  return p.key ?? `${p.lat.toFixed(5)},${p.lng.toFixed(5)}|${p.name}`;
}

export function decodePoint(v: string | null | undefined): Point | null {
  if (!v) return null;
  const known = findPlace(v);
  if (known) return { key: known.key, name: known.name, lat: known.lat, lng: known.lng };
  const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:\|(.*))?$/.exec(v);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { name: (m[3] || "Pinned location").slice(0, 80), lat, lng };
}

/** Centre of the service area, for maps with nothing to show yet. */
export const REGION_CENTER = { lat: 33.66, lng: 73.0 };
