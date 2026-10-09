import { z } from "zod";

/**
 * A vehicle is a grid seen from above, front of the vehicle at row 0.
 * Seats sitting directly side by side in the same row (no aisle/empty cell between them) are neighbours,
 * and neighbours may not be booked by passengers of opposite genders.
 */
export const CELL_KINDS = ["seat", "driver", "door", "empty"] as const;
export type CellKind = (typeof CELL_KINDS)[number];

export const SEAT_GENDERS = ["male", "female", "any"] as const;
export type SeatGender = (typeof SEAT_GENDERS)[number];

export const GENDERS = ["male", "female"] as const;
export type Gender = (typeof GENDERS)[number];

/** `fare` (whole rupees) overrides the trip's fare for one seat, e.g. a pricier front seat. */
export type Cell = { kind: CellKind; gender?: SeatGender; fare?: number };
export type Layout = { rows: number; cols: number; cells: Cell[][] };

export const MAX_ROWS = 12;
export const MAX_COLS = 6;
export const MAX_FARE = 100_000;

const cellSchema = z.object({
  kind: z.enum(CELL_KINDS),
  gender: z.enum(SEAT_GENDERS).optional(),
  fare: z.number().int().min(0).max(MAX_FARE).optional(),
});

export const layoutSchema = z
  .object({
    rows: z.number().int().min(1).max(MAX_ROWS),
    cols: z.number().int().min(1).max(MAX_COLS),
    cells: z.array(z.array(cellSchema)),
  })
  .refine((l) => l.cells.length === l.rows && l.cells.every((row) => row.length === l.cols), "Layout grid size does not match rows/cols")
  .refine((l) => l.cells.some((row) => row.some((c) => c.kind === "seat")), "Add at least one seat")
  .transform((l): Layout => ({
    ...l,
    // Only seats carry a gender.
    cells: l.cells.map((row) =>
      row.map((c): Cell => (c.kind === "seat" ? { kind: "seat", gender: c.gender ?? "any", ...(c.fare !== undefined ? { fare: c.fare } : {}) } : { kind: c.kind })),
    ),
  }));

export function parseLayout(input: unknown): Layout {
  return layoutSchema.parse(input);
}

export const seatId = (r: number, c: number) => `${r}-${c}`;

export type Seat = { id: string; r: number; c: number; label: string; gender: SeatGender; fare?: number };

/** Seats in reading order (front to back, left to right), numbered from 1. */
export function seatList(layout: Layout): Seat[] {
  const seats: Seat[] = [];
  layout.cells.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell.kind === "seat") seats.push({ id: seatId(r, c), r, c, label: String(seats.length + 1), gender: cell.gender ?? "any", fare: cell.fare });
    }),
  );
  return seats;
}

export function findSeat(layout: Layout, id: string): Seat | undefined {
  return seatList(layout).find((s) => s.id === id);
}

/** Seats directly left and right of a seat in the same row. */
export function neighbours(layout: Layout, id: string): string[] {
  const seat = findSeat(layout, id);
  if (!seat) return [];
  return [seat.c - 1, seat.c + 1]
    .filter((c) => layout.cells[seat.r]?.[c]?.kind === "seat")
    .map((c) => seatId(seat.r, c));
}

export type Taken = Record<string, Gender>;

export type SeatCheck = { ok: true } | { ok: false; reason: string };

/** Can a passenger of `gender` sit in `id`, given the seats already taken? */
export function checkSeat(layout: Layout, taken: Taken, id: string, gender: Gender): SeatCheck {
  const seat = findSeat(layout, id);
  if (!seat) return { ok: false, reason: "That seat does not exist." };
  if (taken[id]) return { ok: false, reason: "That seat was just taken. Please pick another one." };
  if (seat.gender !== "any" && seat.gender !== gender) {
    return { ok: false, reason: `Seat ${seat.label} is reserved for ${seat.gender === "male" ? "males" : "females"}.` };
  }
  if (neighbours(layout, id).some((n) => taken[n] && taken[n] !== gender)) {
    return { ok: false, reason: `Seat ${seat.label} is next to a passenger of the opposite gender.` };
  }
  return { ok: true };
}

export type SeatStats = { total: number; free: number; freeFor: Record<Gender, number> };

export function seatStats(layout: Layout, taken: Taken): SeatStats {
  const seats = seatList(layout);
  const free = seats.filter((s) => !taken[s.id]);
  return {
    total: seats.length,
    free: free.length,
    freeFor: {
      male: free.filter((s) => checkSeat(layout, taken, s.id, "male").ok).length,
      female: free.filter((s) => checkSeat(layout, taken, s.id, "female").ok).length,
    },
  };
}

/** Pairs of neighbouring seats the admin reserved for different genders: only one of each pair can ever be used. */
export function genderClashes(layout: Layout): [Seat, Seat][] {
  const seats = seatList(layout);
  const clashes: [Seat, Seat][] = [];
  for (const s of seats) {
    const right = seats.find((o) => o.r === s.r && o.c === s.c + 1);
    if (right && s.gender !== "any" && right.gender !== "any" && s.gender !== right.gender) clashes.push([s, right]);
  }
  return clashes;
}

/** Why a new layout would break existing bookings (seat removed, or reserved for the other gender), if it would. */
export function layoutConflicts(next: Layout, taken: Taken, prev: Layout): string[] {
  const prevLabels = new Map(seatList(prev).map((s) => [s.id, s.label]));
  const problems: string[] = [];
  for (const [id, gender] of Object.entries(taken)) {
    const label = prevLabels.get(id) ?? id;
    const seat = findSeat(next, id);
    if (!seat) problems.push(`Seat ${label} is booked and can't be removed.`);
    else if (seat.gender !== "any" && seat.gender !== gender) problems.push(`Seat ${label} is booked by a ${gender} passenger.`);
  }
  return problems;
}

export function emptyLayout(rows: number, cols: number): Layout {
  return { rows, cols, cells: Array.from({ length: rows }, () => Array.from({ length: cols }, (): Cell => ({ kind: "empty" })) ) };
}

/**
 * Toyota Hiace (high roof): driver + 15 passengers.
 * Front: driver and two seats. Three rows of 2 + aisle + 1. Back bench of 4.
 * Front half reserved for females, back half for males, as a starting point the admin can change.
 */
export function hiaceLayout(): Layout {
  const S = (gender: SeatGender): Cell => ({ kind: "seat", gender });
  const D: Cell = { kind: "driver" };
  const E: Cell = { kind: "empty" };
  const X: Cell = { kind: "door" };
  return {
    rows: 5,
    cols: 4,
    cells: [
      [D, E, S("female"), S("female")],
      [S("female"), S("female"), X, S("female")],
      [S("any"), S("any"), E, S("any")],
      [S("male"), S("male"), E, S("male")],
      [S("male"), S("male"), S("male"), S("male")],
    ],
  };
}

/** Coaster-style 2 + 2 bus with `rows` passenger rows and a 5-seat back bench. */
export function busLayout(rows = 6): Layout {
  const S: Cell = { kind: "seat", gender: "any" };
  const E: Cell = { kind: "empty" };
  const body = Array.from({ length: rows }, () => [S, S, E, S, S]);
  return {
    rows: rows + 2,
    cols: 5,
    cells: [[{ kind: "driver" }, E, E, { kind: "door" }, E], ...body, [S, S, S, S, S]],
  };
}

/** What a seat costs: its own fare if the admin set one, otherwise the trip's fare (null = no fare set). */
export function seatFare(layout: Layout, id: string, tripFare: number | null): number | null {
  return findSeat(layout, id)?.fare ?? tripFare;
}

/** Lowest and highest fare across the seats, or null when no fare is set anywhere. */
export function fareRange(layout: Layout, tripFare: number | null): { min: number; max: number } | null {
  const fares = seatList(layout).flatMap((s) => {
    const f = s.fare ?? tripFare;
    return f === null || f === undefined ? [] : [f];
  });
  return fares.length ? { min: Math.min(...fares), max: Math.max(...fares) } : null;
}
