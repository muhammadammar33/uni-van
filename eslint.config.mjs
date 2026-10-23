import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // public/ocr: the card reader's third-party files, copied as they are.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/ocr/**"]),
]);
