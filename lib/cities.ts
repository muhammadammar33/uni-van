/**
 * Cities and towns across Pakistan for rides between cities. Coordinates are the town centre (approximate);
 * drivers can still add exact pickup spots, or drop a pin.
 */
export type City = { key: string; name: string; province: Province; lat: number; lng: number };

export const PROVINCES = ["Islamabad & Rawalpindi", "Punjab", "Khyber Pakhtunkhwa", "Sindh", "Balochistan", "Azad Kashmir", "Gilgit-Baltistan"] as const;
export type Province = (typeof PROVINCES)[number];

const C = (province: Province, key: string, name: string, lat: number, lng: number): City => ({ key: `c-${key}`, name, province, lat, lng });

export const CITIES: City[] = [
  C("Islamabad & Rawalpindi", "islamabad", "Islamabad", 33.6844, 73.0479),
  C("Islamabad & Rawalpindi", "rawalpindi", "Rawalpindi", 33.5973, 73.0479),
  C("Islamabad & Rawalpindi", "wah", "Wah Cantt", 33.7915, 72.723),
  C("Islamabad & Rawalpindi", "taxila", "Taxila", 33.7455, 72.836),
  C("Islamabad & Rawalpindi", "rawat", "Rawat", 33.4955, 73.193),

  C("Punjab", "lahore", "Lahore", 31.5204, 74.3587),
  C("Punjab", "faisalabad", "Faisalabad", 31.4504, 73.135),
  C("Punjab", "multan", "Multan", 30.1575, 71.5249),
  C("Punjab", "gujranwala", "Gujranwala", 32.1877, 74.1945),
  C("Punjab", "sialkot", "Sialkot", 32.4945, 74.5229),
  C("Punjab", "sargodha", "Sargodha", 32.074, 72.6861),
  C("Punjab", "bahawalpur", "Bahawalpur", 29.3956, 71.6836),
  C("Punjab", "sahiwal", "Sahiwal", 30.6682, 73.1114),
  C("Punjab", "sheikhupura", "Sheikhupura", 31.7167, 73.985),
  C("Punjab", "jhang", "Jhang", 31.2681, 72.3181),
  C("Punjab", "rahim-yar-khan", "Rahim Yar Khan", 28.4202, 70.2952),
  C("Punjab", "gujrat", "Gujrat", 32.5731, 74.0789),
  C("Punjab", "kasur", "Kasur", 31.1187, 74.4467),
  C("Punjab", "okara", "Okara", 30.8138, 73.4534),
  C("Punjab", "dg-khan", "Dera Ghazi Khan", 30.0561, 70.6348),
  C("Punjab", "jhelum", "Jhelum", 32.9425, 73.7257),
  C("Punjab", "chakwal", "Chakwal", 32.9328, 72.863),
  C("Punjab", "attock", "Attock", 33.7667, 72.36),
  C("Punjab", "hassan-abdal", "Hassan Abdal", 33.8195, 72.689),
  C("Punjab", "mianwali", "Mianwali", 32.5839, 71.537),
  C("Punjab", "khanewal", "Khanewal", 30.3017, 71.9321),
  C("Punjab", "vehari", "Vehari", 30.0452, 72.3489),
  C("Punjab", "muzaffargarh", "Muzaffargarh", 30.0703, 71.1933),
  C("Punjab", "bahawalnagar", "Bahawalnagar", 29.9987, 73.2536),
  C("Punjab", "hafizabad", "Hafizabad", 32.0709, 73.688),
  C("Punjab", "mandi-bahauddin", "Mandi Bahauddin", 32.5861, 73.4917),
  C("Punjab", "narowal", "Narowal", 32.102, 74.873),
  C("Punjab", "toba-tek-singh", "Toba Tek Singh", 30.9709, 72.4826),
  C("Punjab", "pakpattan", "Pakpattan", 30.3436, 73.387),
  C("Punjab", "khushab", "Khushab", 32.2967, 72.3526),
  C("Punjab", "bhakkar", "Bhakkar", 31.6338, 71.0654),
  C("Punjab", "layyah", "Layyah", 30.9693, 70.9428),
  C("Punjab", "chiniot", "Chiniot", 31.72, 72.9784),
  C("Punjab", "nankana", "Nankana Sahib", 31.45, 73.7065),
  C("Punjab", "lodhran", "Lodhran", 29.5339, 71.6324),
  C("Punjab", "rajanpur", "Rajanpur", 29.1044, 70.3301),
  C("Punjab", "murree", "Murree", 33.907, 73.3943),
  C("Punjab", "gujar-khan", "Gujar Khan", 33.2539, 73.304),
  C("Punjab", "kharian", "Kharian", 32.8113, 73.865),
  C("Punjab", "lalamusa", "Lalamusa", 32.7006, 73.9576),
  C("Punjab", "talagang", "Talagang", 32.9277, 72.4157),
  C("Punjab", "fateh-jang", "Fateh Jang", 33.565, 72.6417),
  C("Punjab", "kallar-kahar", "Kallar Kahar (Motorway)", 32.7745, 72.6985),
  C("Punjab", "bhera", "Bhera (Motorway)", 32.4839, 72.9089),
  C("Punjab", "pindi-bhattian", "Pindi Bhattian", 31.8976, 73.2735),

  C("Khyber Pakhtunkhwa", "peshawar", "Peshawar", 34.0151, 71.5249),
  C("Khyber Pakhtunkhwa", "mardan", "Mardan", 34.1989, 72.0231),
  C("Khyber Pakhtunkhwa", "abbottabad", "Abbottabad", 34.1688, 73.2215),
  C("Khyber Pakhtunkhwa", "mansehra", "Mansehra", 34.3302, 73.1968),
  C("Khyber Pakhtunkhwa", "haripur", "Haripur", 33.9946, 72.934),
  C("Khyber Pakhtunkhwa", "nowshera", "Nowshera", 34.0153, 71.9747),
  C("Khyber Pakhtunkhwa", "charsadda", "Charsadda", 34.1453, 71.7308),
  C("Khyber Pakhtunkhwa", "swabi", "Swabi", 34.1201, 72.4702),
  C("Khyber Pakhtunkhwa", "mingora", "Mingora (Swat)", 34.7717, 72.36),
  C("Khyber Pakhtunkhwa", "kohat", "Kohat", 33.5869, 71.4429),
  C("Khyber Pakhtunkhwa", "bannu", "Bannu", 32.9889, 70.6056),
  C("Khyber Pakhtunkhwa", "di-khan", "Dera Ismail Khan", 31.8313, 70.9017),
  C("Khyber Pakhtunkhwa", "karak", "Karak", 33.1167, 71.0944),
  C("Khyber Pakhtunkhwa", "lakki-marwat", "Lakki Marwat", 32.6072, 70.9123),
  C("Khyber Pakhtunkhwa", "hangu", "Hangu", 33.532, 71.059),
  C("Khyber Pakhtunkhwa", "timergara", "Timergara (Dir)", 34.8286, 71.8418),
  C("Khyber Pakhtunkhwa", "chitral", "Chitral", 35.8518, 71.7864),
  C("Khyber Pakhtunkhwa", "nathia-gali", "Nathia Gali", 34.073, 73.381),
  C("Khyber Pakhtunkhwa", "naran", "Naran", 34.909, 73.651),

  C("Sindh", "karachi", "Karachi", 24.8607, 67.0011),
  C("Sindh", "hyderabad", "Hyderabad", 25.396, 68.3578),
  C("Sindh", "sukkur", "Sukkur", 27.7052, 68.8574),
  C("Sindh", "larkana", "Larkana", 27.557, 68.2264),
  C("Sindh", "nawabshah", "Nawabshah", 26.2442, 68.41),
  C("Sindh", "mirpur-khas", "Mirpur Khas", 25.5276, 69.0111),
  C("Sindh", "jacobabad", "Jacobabad", 28.2769, 68.4514),
  C("Sindh", "shikarpur", "Shikarpur", 27.9556, 68.6382),
  C("Sindh", "khairpur", "Khairpur", 27.5295, 68.7592),
  C("Sindh", "dadu", "Dadu", 26.7319, 67.775),
  C("Sindh", "thatta", "Thatta", 24.7461, 67.9236),
  C("Sindh", "badin", "Badin", 24.656, 68.837),
  C("Sindh", "umerkot", "Umerkot", 25.3615, 69.7362),
  C("Sindh", "mithi", "Mithi", 24.7363, 69.7975),
  C("Sindh", "sanghar", "Sanghar", 26.0465, 68.9481),
  C("Sindh", "ghotki", "Ghotki", 28.006, 69.3153),

  C("Balochistan", "quetta", "Quetta", 30.1798, 66.975),
  C("Balochistan", "gwadar", "Gwadar", 25.1264, 62.3225),
  C("Balochistan", "turbat", "Turbat", 26.0023, 63.044),
  C("Balochistan", "khuzdar", "Khuzdar", 27.8, 66.6167),
  C("Balochistan", "hub", "Hub", 25.049, 66.889),
  C("Balochistan", "sibi", "Sibi", 29.543, 67.8773),
  C("Balochistan", "zhob", "Zhob", 31.341, 69.4486),
  C("Balochistan", "chaman", "Chaman", 30.921, 66.4597),
  C("Balochistan", "loralai", "Loralai", 30.3705, 68.598),
  C("Balochistan", "uthal", "Uthal (Lasbela)", 25.8072, 66.6219),

  C("Azad Kashmir", "muzaffarabad", "Muzaffarabad", 34.37, 73.4711),
  C("Azad Kashmir", "mirpur", "Mirpur (AJK)", 33.1478, 73.7518),
  C("Azad Kashmir", "rawalakot", "Rawalakot", 33.8578, 73.7604),
  C("Azad Kashmir", "kotli", "Kotli", 33.5156, 73.9019),
  C("Azad Kashmir", "bagh", "Bagh", 33.981, 73.776),

  C("Gilgit-Baltistan", "gilgit", "Gilgit", 35.9208, 74.308),
  C("Gilgit-Baltistan", "skardu", "Skardu", 35.2971, 75.6333),
  C("Gilgit-Baltistan", "hunza", "Hunza (Karimabad)", 36.3167, 74.65),
  C("Gilgit-Baltistan", "chilas", "Chilas", 35.4206, 74.096),
];

export const findCity = (key: string | null | undefined) => (key ? CITIES.find((c) => c.key === key) : undefined);

/**
 * The area "city" rides cover: Islamabad, Rawalpindi, Wah, Taxila and Rawat (with a margin for the edges).
 * Anything outside is a ride between cities.
 */
export const CITY_AREA = { minLat: 33.4, maxLat: 33.9, minLng: 72.66, maxLng: 73.3 };
export const inCityArea = (p: { lat: number; lng: number }) =>
  p.lat >= CITY_AREA.minLat && p.lat <= CITY_AREA.maxLat && p.lng >= CITY_AREA.minLng && p.lng <= CITY_AREA.maxLng;

export type RideKind = "city" | "intercity";
export const RIDE_KINDS = ["city", "intercity"] as const;
/** How close (km) a rider's pickup and drop-off must be to the ride's stops. */
export const MATCH_RADIUS_KM: Record<RideKind, number> = { city: 3, intercity: 25 };

/** The kind asked for in a link, or (old links) guessed from the places: anything outside the city area is intercity. */
export function kindFor(param: string | null | undefined, ...pts: ({ lat: number; lng: number } | null)[]): RideKind {
  if (param === "city" || param === "intercity") return param;
  return pts.some((p) => p && !inCityArea(p)) ? "intercity" : "city";
}
