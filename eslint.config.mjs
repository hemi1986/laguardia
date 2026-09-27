import boundaries from "eslint-plugin-boundaries";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // ADR 0002: modules (src/modules/<name>) are used through their public interface (index.ts) only.
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "import/resolver": { typescript: { alwaysTryTypes: true } },
      "boundaries/elements": [
        { type: "module", pattern: "src/modules/*", capture: ["moduleName"] },
        { type: "platform", pattern: "src/platform" },
        { type: "app", pattern: "src/app" },
        { type: "shared", pattern: "src/(photo|spike|test-support)" },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "allow",
          policies: [
            {
              // Another module's internals: any file of a module but its index.ts (imports inside a module are not checked).
              disallow: { to: { element: { type: "module", fileInternalPath: "!index.ts" } } },
              message: "Import another module only through its public interface (index.ts) – ADR 0002",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "test-results/**",
    "playwright-report/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".claude/**",
    "docs/**",
    "drizzle/**",
  ]),
]);

export default eslintConfig;
