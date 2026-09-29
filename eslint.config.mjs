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
        { type: "spike", pattern: "src/spike" },
        { type: "ui", pattern: "src/(components|lib)" },
        { type: "shared", pattern: "src/(photo|test-support)" },
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
            {
              // Direction app → modules → platform: the platform knows no module, page or spike code.
              // Tests of the platform may drive a real module command.
              from: { element: { type: "platform", fileInternalPath: "!**/*.test.ts" } },
              disallow: { to: { element: { type: ["module", "app", "spike"] } } },
              message: "The platform must not depend on modules, the app or the spike – ADR 0002",
            },
            {
              from: { element: { type: "module" } },
              disallow: { to: { element: { type: ["app", "spike"] } } },
              message: "A module must not depend on the app or the spike – ADR 0002",
            },
            {
              // Shared UI components (ST-076) carry no domain logic: a page may use them, they know nothing of
              // the domain. Their texts come in as props, so they never read a message catalog either.
              from: { element: { type: "ui" } },
              disallow: { to: { element: { type: ["module", "platform", "app", "spike"] } } },
              message: "A UI component must not depend on a module, the platform, the app or the spike – ST-076",
            },
          ],
        },
      ],
    },
  },
  {
    // Architecture review Q5/Q20 (ST-073): one definition each – the role in the command layer, the reporter in
    // the problem report, derived from the acting person in one place.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/platform/command/index.ts", "src/modules/repair/report-problem.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: ":matches(TSTypeAliasDeclaration, TSInterfaceDeclaration)[id.name='Role']",
          message:
            "Role is defined once, in src/platform/command/index.ts – import it from @/platform/command (ST-073)",
        },
        {
          selector: ":matches(TSTypeAliasDeclaration, TSInterfaceDeclaration)[id.name='Reporter']",
          message:
            "Reporter is defined once, in src/modules/repair/report-problem.ts – import it from @/modules/repair (ST-073)",
        },
      ],
    },
  },
  {
    // Architecture review Q10 (ST-073): the Server Action runner in src/app/_actions/ is the only way from a form
    // to a command – it takes the acting person from currentPerson(), so no Server Action can pass its own actor.
    files: ["src/app/**/*.{ts,tsx}"],
    ignores: ["src/app/_actions/**", "src/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/platform/command", "**/platform/command", "**/platform/command/index"],
              importNames: ["executeCommand"],
              message:
                "A Server Action runs a command only through the runner in src/app/_actions/ (formAction) – it takes the acting person from currentPerson() (ST-073)",
            },
            {
              group: ["@/app/_actions/form-runner", "**/_actions/form-runner"],
              message:
                "Use formAction from src/app/_actions/ – formRunner takes an own acting person and is only for the runner and its tests (ST-073)",
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
