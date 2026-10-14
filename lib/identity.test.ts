import assert from "node:assert/strict";
import { test } from "node:test";
import { ageOn, checkId, cleanIdNumber, formatIdNumber, genderFromIdNumber, parseCnicFront } from "./identityRules";

const T = "2026-10-14";
const base = { mode: "rider" as const, idType: "cnic" as const, idNumber: "35202-1234567-3", gender: "male" as const, dob: "1995-04-26", idExpiry: "2031-04-26" };

test("CNIC numbers: cleaning, formatting, gender digit", () => {
  assert.equal(cleanIdNumber("35202-1234567-3"), "3520212345673");
  assert.equal(cleanIdNumber("3520212345"), null);
  assert.equal(formatIdNumber("3520212345673"), "35202-1234567-3");
  assert.equal(genderFromIdNumber("3520212345673"), "male");
  assert.equal(genderFromIdNumber("3520212345674"), "female");
  assert.equal(ageOn("2008-10-15", T), 17);
  assert.equal(ageOn("2008-10-14", T), 18);
});

test("ID checks: valid rider, expired CNIC, gender mismatch warning", () => {
  assert.deepEqual(checkId(base, T), { errors: [], warnings: [] });
  assert.match(checkId({ ...base, idExpiry: "2025-01-01" }, T).errors.join(), /expired/);
  assert.equal(checkId({ ...base, idExpiry: "lifetime" }, T).errors.length, 0);
  assert.match(checkId({ ...base, gender: "female" }, T).warnings.join(), /last digit means male/);
});

test("ID checks: drivers need 18+ and a valid licence", () => {
  const d = { ...base, mode: "driver" as const, licenseExpiry: "2028-01-01" };
  assert.deepEqual(checkId(d, T).errors, []);
  assert.match(checkId({ ...d, licenseExpiry: "2024-01-01" }, T).errors.join(), /licence has expired/);
  assert.match(checkId({ ...d, licenseExpiry: undefined }, T).errors.join(), /licence expiry/);
});

test("ID checks: under 18 uses a B-form with a parent's CNIC, and can't drive", () => {
  const kid = { ...base, idType: "bform" as const, dob: "2010-03-01", idExpiry: null, guardianCnic: "61101-7654321-2" };
  assert.deepEqual(checkId(kid, T).errors, []);
  assert.match(checkId({ ...kid, guardianCnic: "" }, T).errors.join(), /parent/);
  assert.match(checkId({ ...kid, dob: "2000-01-01" }, T).errors.join(), /own CNIC/);
  assert.match(checkId({ ...kid, mode: "driver", licenseExpiry: "2030-01-01" }, T).errors.join(), /Drivers need/);
});

test("Reads the front of a CNIC from OCR text", () => {
  const text = `PAKISTAN National Identity Card
ISLAMIC REPUBLIC OF PAKISTAN
Name
Ahmed Raza
Father Name
Muhammad Raza
Gender Country of Stay
M Pakistan
Identity Number Date of Birth
35202-1234567-3 26.04.1995
Date of Issue Date of Expiry
12.06.2021 12.06.2031`;
  const r = parseCnicFront(text);
  assert.equal(r.idNumber, "3520212345673");
  assert.equal(r.name, "Ahmed Raza");
  assert.equal(r.fatherName, "Muhammad Raza");
  assert.equal(r.gender, "male");
  assert.equal(r.dob, "1995-04-26");
  assert.equal(r.expiry, "2031-06-12");
});

test("card scan: noise before labels (what the scanner really read)", () => {
  const r = parseCnicFront(
    "Name\nBilal Ahmed Qureshi\n\nCO Father Name\nAhmed Qureshi\nGender Country of Stay\nM Pakistan\nIdentity Number Date of Birth\n37405-2468135-7 14.08.1992\nDate of Issue Date of Expiry\n10.01.2021 10.01.2031",
  );
  assert.deepEqual(r, { idNumber: "3740524681357", name: "Bilal Ahmed Qureshi", fatherName: "Ahmed Qureshi", gender: "male", dob: "1992-08-14", expiry: "2031-01-10" });
});
