import assert from "node:assert/strict";
import { test } from "node:test";
import { toOrigin } from "./url";

test("SITE_URL is accepted the way people type it", () => {
  for (const v of ["https://hamsafar.website", "hamsafar.website", " https://hamsafar.website/ ", '"https://hamsafar.website"', "https://hamsafar.website/some/path", "HTTPS://hamsafar.website"])
    assert.equal(toOrigin(v), "https://hamsafar.website", v);
  assert.equal(toOrigin("https://www.hamsafar.website"), "https://www.hamsafar.website");
  assert.equal(toOrigin("http://localhost:3000"), "http://localhost:3000");
  for (const v of [undefined, "", "  ", "not a url", "https://", "hamsafar"]) assert.equal(toOrigin(v), null, String(v));
});
