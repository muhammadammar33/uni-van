/** The platform's name and contact, set per deployment. Each client organisation has its own name in the database. */
export const BRAND = {
  name: process.env.NEXT_PUBLIC_PLATFORM_NAME || "Hamsafar",
  tagline: process.env.NEXT_PUBLIC_PLATFORM_TAGLINE || "Seat booking for every van, coaster and bus in Pakistan.",
  /** WhatsApp number for "Contact us", digits with country code (e.g. 923001234567). Optional. */
  whatsapp: (process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || "").replace(/\D/g, ""),
};
