import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright output (HTML report bundles, traces).
    "playwright-report/**",
    "test-results/**",
    // Optional Cloudflare Email Worker: plain JS for wrangler, with its own package.json.
    "workers/**",
  ]),
]);

export default eslintConfig;
