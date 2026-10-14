import { test } from "node:test";
import assert from "node:assert/strict";
import { CITIES, inCityArea, kindFor } from "./cities";
import { matchStops } from "./geo";
import { decodePoint, findPlace, PLACES } from "./places";

test("city keys are unique, don't clash with places, and are in Pakistan", () => {
  const keys = [...CITIES, ...PLACES].map((c) => c.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const c of CITIES) {
    assert.ok(c.lat > 23.5 && c.lat < 37.1 && c.lng > 60.8 && c.lng < 77.9, c.key);
    assert.equal(decodePoint(c.key)?.name, c.name);
  }
});

test("the city area holds every listed place and none of the far cities", () => {
  for (const p of PLACES) assert.ok(inCityArea(p), p.key);
  for (const k of ["c-lahore", "c-peshawar", "c-murree", "c-abbottabad", "c-attock", "c-fateh-jang", "c-gujar-khan", "c-karachi"]) assert.ok(!inCityArea(findPlace(k)!), k);
});

test("kindFor uses the link, else guesses from the places", () => {
  assert.equal(kindFor("intercity"), "intercity");
  assert.equal(kindFor(null, findPlace("g9")!, findPlace("rawat")!), "city");
  assert.equal(kindFor(null, findPlace("g9")!, findPlace("c-lahore")!), "intercity");
  assert.equal(kindFor(undefined, null, null), "city");
});

test("intercity matching: near a stop, in order", () => {
  const route = ["c-islamabad", "c-jhelum", "c-gujranwala", "c-lahore"].map((k) => findPlace(k)!);
  const m = matchStops(route, findPlace("g9")!, findPlace("c-lahore")!, 25);
  assert.ok(m && m.pickupPos === 0 && m.dropPos === 3 && m.pickupKm < 10);
  assert.equal(matchStops(route, findPlace("c-lahore")!, findPlace("c-islamabad")!, 25), null);
  assert.equal(matchStops(route, findPlace("c-peshawar")!, findPlace("c-lahore")!, 25), null);
  assert.ok(matchStops(route, findPlace("c-kharian")!, findPlace("c-lahore")!, 40)); // Kharian ~30 km from Jhelum
});
