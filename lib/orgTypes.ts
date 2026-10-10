/**
 * The kinds of client the platform serves. Each one gets its own wording and default booking rules;
 * the data model is the same for all of them.
 */
export const ORG_TYPES = ["transport", "institution", "tour", "company"] as const;
export type OrgType = (typeof ORG_TYPES)[number];

export type OrgTypeInfo = {
  label: string;
  /** One line for the super admin and the home page. */
  blurb: string;
  /** Who rides: "passenger", "student", "traveller", "employee". */
  rider: string;
  riders: string;
  /** Has a registered list of riders (CSV/Excel import). */
  roster: boolean;
  /** Label for the roll number / employee ID column. */
  refLabel: string;
  /** Label for the class / department column. */
  groupLabel: string;
  /** Trip directions: stops are pickups on the first, drop-offs on the second. */
  direction: { to_uni: string; to_home: string };
  /** Defaults for a new trip. */
  defaults: { genderRule: "separate" | "none"; maxSeats: number; membersOnly: boolean };
  /** Multi-day trips with an itinerary. */
  multiDay: boolean;
  emoji: string;
};

export const ORG_TYPE_INFO: Record<OrgType, OrgTypeInfo> = {
  transport: {
    label: "Van & coaster operator",
    blurb: "Private vans and coasters carrying students and commuters between cities. Riders change every trip.",
    rider: "passenger",
    riders: "passengers",
    roster: false,
    refLabel: "ID",
    groupLabel: "Group",
    direction: { to_uni: "Outbound", to_home: "Return" },
    defaults: { genderRule: "separate", maxSeats: 1, membersOnly: false },
    multiDay: false,
    emoji: "🚐",
  },
  institution: {
    label: "University, college or school",
    blurb: "Transport office for registered students: upload the student list, students book their seat daily.",
    rider: "student",
    riders: "students",
    roster: true,
    refLabel: "Roll no.",
    groupLabel: "Class / programme",
    direction: { to_uni: "To campus", to_home: "From campus" },
    defaults: { genderRule: "separate", maxSeats: 1, membersOnly: true },
    multiDay: false,
    emoji: "🎓",
  },
  tour: {
    label: "Tour operator",
    blurb: "One-off trips and tours. Travellers book for themselves or their family; nothing is kept after the trip.",
    rider: "traveller",
    riders: "travellers",
    roster: false,
    refLabel: "ID",
    groupLabel: "Group",
    direction: { to_uni: "Departure", to_home: "Return" },
    defaults: { genderRule: "none", maxSeats: 6, membersOnly: false },
    multiDay: true,
    emoji: "🏔️",
  },
  company: {
    label: "Company staff transport",
    blurb: "Pick-and-drop for a factory, office or hospital: registered employees book on their shift's van.",
    rider: "employee",
    riders: "employees",
    roster: true,
    refLabel: "Employee ID",
    groupLabel: "Department / shift",
    direction: { to_uni: "To work", to_home: "From work" },
    defaults: { genderRule: "separate", maxSeats: 1, membersOnly: true },
    multiDay: false,
    emoji: "🏢",
  },
};

export const orgInfo = (type: OrgType) => ORG_TYPE_INFO[type];

/** "Saddar Chowk" style wording for a trip's stops. */
export function stopWord(direction: "to_uni" | "to_home") {
  return direction === "to_home" ? "drop-off" : "pickup";
}

/** URL-friendly id from a name: "Northern Trails Tours" -> "northern-trails-tours". */
export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "org"
  );
}
