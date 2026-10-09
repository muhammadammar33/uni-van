import assert from "node:assert/strict";
import { test } from "node:test";
import { checkSeat, fareRange, genderClashes, seatFare, hiaceLayout, layoutConflicts, neighbours, parseLayout, seatList, seatStats } from "./layout";
import { formatDate, formatFare, formatTime, normalizePhone } from "./format";

const hiace = hiaceLayout();

test("hiace has 15 passenger seats numbered front to back", () => {
  const seats = seatList(hiace);
  assert.equal(seats.length, 15);
  assert.equal(seats[0].id, "0-2");
  assert.equal(seats[0].label, "1");
  assert.equal(seats.at(-1)!.label, "15");
});

test("aisles and doors separate neighbours", () => {
  assert.deepEqual(neighbours(hiace, "1-1"), ["1-0"]); // door at 1-2
  assert.deepEqual(neighbours(hiace, "1-3"), []);
  assert.deepEqual(neighbours(hiace, "4-1").sort(), ["4-0", "4-2"]);
});

test("reserved seats only take their gender", () => {
  assert.equal(checkSeat(hiace, {}, "0-2", "female").ok, true);
  assert.equal(checkSeat(hiace, {}, "0-2", "male").ok, false);
});

test("opposite genders can't sit side by side on open seats", () => {
  const taken = { "2-0": "female" as const };
  assert.equal(checkSeat(hiace, taken, "2-1", "male").ok, false);
  assert.equal(checkSeat(hiace, taken, "2-1", "female").ok, true);
  assert.equal(checkSeat(hiace, taken, "2-3", "male").ok, true); // across the aisle
  assert.equal(checkSeat(hiace, taken, "2-0", "female").ok, false); // already taken
});

test("stats count seats each gender can still take", () => {
  const stats = seatStats(hiace, { "2-0": "female" });
  assert.equal(stats.total, 15);
  assert.equal(stats.free, 14);
  assert.equal(stats.freeFor.female, 5 + 2); // 5 female seats + 2-1 and 2-3
  assert.equal(stats.freeFor.male, 7 + 1); // 7 male seats + 2-3
});

test("layout edits can't break existing bookings", () => {
  const next = structuredClone(hiace);
  next.cells[2][0] = { kind: "seat", gender: "male" };
  next.cells[0][2] = { kind: "empty" };
  const problems = layoutConflicts(next, { "2-0": "female", "0-2": "female", "4-0": "male" }, hiace);
  assert.equal(problems.length, 2);
});

test("clashing reservations are reported", () => {
  const l = structuredClone(hiace);
  l.cells[2][0] = { kind: "seat", gender: "male" };
  l.cells[2][1] = { kind: "seat", gender: "female" };
  assert.equal(genderClashes(l).length, 1);
});

test("parseLayout rejects mismatched grids and strips gender from non-seats", () => {
  assert.throws(() => parseLayout({ rows: 2, cols: 2, cells: [[{ kind: "seat" }]] }));
  const l = parseLayout({ rows: 1, cols: 2, cells: [[{ kind: "seat" }, { kind: "door", gender: "male" }]] });
  assert.deepEqual(l.cells[0], [{ kind: "seat", gender: "any" }, { kind: "door" }]);
});

test("phone numbers normalise to one form", () => {
  for (const p of ["0300-1234567", "+92 300 1234567", "923001234567", "3001234567", "0092 300 1234567"]) {
    assert.equal(normalizePhone(p), "923001234567");
  }
  assert.equal(normalizePhone("12345"), null);
});

test("times format as 12-hour", () => {
  assert.equal(formatTime("07:05"), "7:05 AM");
  assert.equal(formatTime("12:30"), "12:30 PM");
  assert.equal(formatTime("00:10"), "12:10 AM");
});

test("dates format the same everywhere", () => {
  assert.equal(formatDate("2026-10-12"), "Mon, 12 Oct");
  assert.equal(formatDate("2026-10-09", true), "Friday, 9 October 2026");
});

test("seat fares fall back to the trip fare", () => {
  const l = structuredClone(hiace);
  l.cells[0][2] = { kind: "seat", gender: "female", fare: 400 };
  assert.equal(seatFare(l, "0-2", 300), 400);
  assert.equal(seatFare(l, "0-3", 300), 300);
  assert.equal(seatFare(l, "0-3", null), null);
  assert.deepEqual(fareRange(l, 300), { min: 300, max: 400 });
  assert.deepEqual(fareRange(l, null), { min: 400, max: 400 });
  assert.equal(fareRange(hiace, null), null);
  assert.equal(formatFare(1500), "Rs. 1,500");
});

test("parseLayout keeps seat fares", () => {
  const l = parseLayout({ rows: 1, cols: 2, cells: [[{ kind: "seat", fare: 350 }, { kind: "door", fare: 9 }]] });
  assert.deepEqual(l.cells[0], [{ kind: "seat", gender: "any", fare: 350 }, { kind: "door" }]);
  assert.throws(() => parseLayout({ rows: 1, cols: 1, cells: [[{ kind: "seat", fare: -5 }]] }));
});
