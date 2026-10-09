/** Product name and contact, set per deployment so each operator can use their own. */
export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "Uni Van",
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE || "Your seat on the university van, booked in seconds.",
  /** WhatsApp number for "Contact us", digits with country code (e.g. 923001234567). Optional. */
  whatsapp: (process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || "").replace(/\D/g, ""),
};
