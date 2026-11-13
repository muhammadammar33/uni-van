import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fareGuide, partFare } from "./fare";

describe("fareGuide", () => {
  it("uses the car's own fuel average", () => {
    assert.equal(fareGuide(21, 340, 12).suggested, 170);
    assert.equal(fareGuide(21, 340, 20).suggested, 100);
    assert.equal(fareGuide(21, 340, null).suggested, 170);
  });
});

describe("partFare", () => {
  const legs = [8.5, 13.2];
  it("charges the whole fare for the whole route", () => assert.equal(partFare(200, legs, 0, 2), 200));
  it("charges by distance travelled", () => {
    assert.equal(partFare(200, legs, 0, 1), 80);
    assert.equal(partFare(200, legs, 1, 2), 120);
  });
  it("keeps a minimum but never above the whole fare", () => {
    assert.equal(partFare(200, [1, 30], 0, 1), 50);
    assert.equal(partFare(40, [1, 30], 0, 1), 40);
  });
  it("keeps free rides free", () => {
    assert.equal(partFare(null, legs, 0, 1), null);
    assert.equal(partFare(0, legs, 0, 1), 0);
  });
});
