/** The platform's name and contact, set per deployment. Each client organisation has its own name in the database. */
export const BRAND = {
  name: process.env.NEXT_PUBLIC_PLATFORM_NAME || "Hamsafar",
  tagline: process.env.NEXT_PUBLIC_PLATFORM_TAGLINE || "Carpooling in Islamabad, Rawalpindi and between cities across Pakistan.",
  /** The site's own domain, shown in footers and link previews. */
  domain: process.env.NEXT_PUBLIC_SITE_DOMAIN || "hamsafar.website",
  /** WhatsApp number for "Contact us", digits with country code (e.g. 923001234567). Optional. */
  whatsapp: (process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || "").replace(/\D/g, ""),
};
