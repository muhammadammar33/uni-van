import assert from "node:assert/strict";
import { test } from "node:test";
import { blur, distanceKm, matchRoute, nearestIndex } from "./geo";
import { decodePoint, encodePoint, findPlace, PLACES } from "./places";
import { describeSchedule, nextRuns, runOver, runsOn } from "./schedule";

const p = (k: string) => findPlace(k)!;

test("places have unique keys and sit between Wah and Rawat", () => {
  assert.equal(new Set(PLACES.map((x) => x.key)).size, PLACES.length);
  for (const x of PLACES) {
    assert.ok(x.lat > 33.4 && x.lat < 33.9, x.name);
    assert.ok(x.lng > 72.6 && x.lng < 73.3, x.name);
  }
  assert.ok(distanceKm(p("wah-cantt"), p("rawat")) > 40);
});

test("route matching: along the way and in the right direction", () => {
  const route = [p("wah-cantt"), p("taxila-chowk"), p("golra-mor"), p("g9"), p("blue-area")];
  // Taxila → G-10 (near the G-9 leg): matches.
  const m = matchRoute(route, p("taxila-chowk"), p("g10"));
  assert.ok(m);
  assert.ok(m!.pickupPos < m!.dropPos);
  // Wrong direction: no.
  assert.equal(matchRoute(route, p("blue-area"), p("wah-cantt")), null);
  // Off the route (Rawat): no.
  assert.equal(matchRoute(route, p("wah-cantt"), p("rawat")), null);
  assert.equal(nearestIndex(route, p("g10")), 3);
});

test("custom points survive the URL", () => {
  const pin = { name: "My street, G-11/2", lat: 33.66512, lng: 72.99871 };
  assert.deepEqual(decodePoint(encodePoint(pin)), { name: "My street, G-11/2", lat: 33.66512, lng: 72.99871 });
  assert.equal(decodePoint("g9")?.name, "G-9 Markaz (Karachi Company)");
  assert.equal(decodePoint("nonsense"), null);
});

test("schedules", () => {
  const weekdays = { kind: "weekly" as const, date: "2026-10-12", days: [1, 2, 3, 4, 5], until: null };
  assert.equal(runsOn(weekdays, "2026-10-17"), false); // Saturday
  assert.equal(runsOn(weekdays, "2026-10-16"), true);
  assert.deepEqual(nextRuns(weekdays, "2026-10-16", 3), ["2026-10-16", "2026-10-19", "2026-10-20"]);
  assert.equal(describeSchedule(weekdays), "Mon – Fri");
  const once = { kind: "once" as const, date: "2026-10-14", days: [], until: null };
  assert.deepEqual(nextRuns(once, "2026-10-13"), ["2026-10-14"]);
  assert.deepEqual(nextRuns(once, "2026-10-15"), []);
  const daily = { kind: "daily" as const, date: "2026-10-13", days: [], until: "2026-10-14" };
  assert.deepEqual(nextRuns(daily, "2026-10-01", 5), ["2026-10-13", "2026-10-14"]);
  assert.equal(describeSchedule({ ...weekdays, days: [1, 3, 5] }), "Mon, Wed, Fri");
});

test("blurred positions move by at most ~250 m", () => {
  const x = { lat: 33.71234, lng: 73.05678 };
  assert.ok(distanceKm(x, blur(x)) < 0.25);
});

test("a ride counts as done an hour after it leaves (then riders can rate it)", () => {
  assert.equal(runOver("2026-10-13", "07:30", "2026-10-14T06:00"), true, "yesterday");
  assert.equal(runOver("2026-10-15", "07:30", "2026-10-14T23:00"), false, "tomorrow");
  assert.equal(runOver("2026-10-14", "07:30", "2026-10-14T08:29"), false, "59 minutes after leaving");
  assert.equal(runOver("2026-10-14", "07:30", "2026-10-14T08:30"), true, "an hour after leaving");
  assert.equal(runOver("2026-10-14", "23:30", "2026-10-15T00:10"), true, "late ride, next day");
});

test("fare guide: fuel share, rounded, capped at 1.5x", async () => {
  const { fareGuide } = await import("./fare");
  const saddar = { lat: 33.5973, lng: 73.0479 }, f6 = { lat: 33.7294, lng: 73.0771 };
  const g = fareGuide([saddar, f6]);
  assert.ok(g.km > 15 && g.km < 22, `km ${g.km}`);
  assert.equal(g.suggested % 10, 0);
  assert.ok(g.suggested >= 100 && g.suggested <= 200, `suggested ${g.suggested}`);
  assert.ok(g.max >= g.suggested * 1.5 && g.max < g.suggested * 1.5 + 10);
  const isl = { lat: 33.6844, lng: 73.0479 }, lhr = { lat: 31.5204, lng: 74.3587 };
  const ig = fareGuide([isl, lhr]);
  assert.ok(ig.suggested > 2000 && ig.suggested < 4000, `intercity ${ig.suggested}`);
  assert.equal(fareGuide([saddar, { lat: 33.598, lng: 73.048 }]).suggested, 50);
});
