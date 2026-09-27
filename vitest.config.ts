import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Tests run on the server side; the guard's "react-server" variant is the empty module.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["src/**/*.test.ts"], exclude: ["src/**/*.integration.test.ts"] },
      },
      {
        // Against a real PostgreSQL (TEST_DATABASE_URL), reset once per test run by the global setup.
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.integration.test.ts"],
          globalSetup: ["src/test-support/reset-test-database.ts"],
          // Better Auth needs a secret; tests use a fixed one (production: BETTER_AUTH_SECRET in Vercel).
          env: { BETTER_AUTH_SECRET: "test-secret-only-for-integration-tests-0123456789" },
        },
      },
    ],
  },
});
