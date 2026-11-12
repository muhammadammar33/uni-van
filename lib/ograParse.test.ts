import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseNoticeList, parsePetrolPrice } from "./ograParse";

test("OGRA: newest notice on the list page", () => {
  const html = readFileSync(new URL("./fixtures/ogra-list-2026-11-13.html", import.meta.url), "utf8");
  assert.deepEqual(parseNoticeList(html), { effective: "2026-11-13", url: "https://www.ogra.org.pk/download/18217?lang=en" });
  assert.equal(parseNoticeList("<p>nothing here</p>"), null);
});

test("OGRA: petrol price from the notice text", () => {
  const text = readFileSync(new URL("./fixtures/ogra-notice-2026-11-13.txt", import.meta.url), "utf8");
  assert.equal(parsePetrolPrice(text), 332);
  assert.equal(parsePetrolPrice("Total Calculated Petrol Price RS/LTR V={P+S+T+U} 331.97"), 331.97);
  assert.equal(parsePetrolPrice("Diesel only"), null);
});
