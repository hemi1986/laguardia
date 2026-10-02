import { existsSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

/** The port of the local browser tests' own dev server (ST-083) – scripts/e2e-server.ts starts it there. */
const E2E_PORT = 3100;

/**
 * Browser tests at phone size (360 px, Definition of Done). BASE_URL points at a deployed preview (CI);
 * without it they run against a local dev server. Previews sit behind Vercel's deployment protection –
 * the automation bypass secret lets the tests through (sent only to the preview, see e2e/fixtures.ts).
 *
 * No traces, screenshots or videos in CI: the repository is public and they would contain the bypass secret. Locally, failed tests keep a trace.
 */
// The one local settings file (also read by `npm run dev` and the scripts) – E2E_TEAM_USERNAME / E2E_TEAM_PASSWORD
// live there. Absent in CI, where the variables come from the environment. Resolved next to this config, like testDir.
const localSettings = join(__dirname, ".env.development.local");
if (existsSync(localSettings)) process.loadEnvFile(localSettings);

const baseURL = process.env.BASE_URL;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    browserName: "chromium",
    viewport: { width: 360, height: 800 },
    isMobile: true,
    hasTouch: true,
    baseURL: baseURL ?? `http://localhost:${E2E_PORT}`,
    trace: process.env.CI ? "off" : "retain-on-failure",
    screenshot: "off",
    video: "off",
  },
  // Locally (ST-083): a dev server of their own on port 3100 against laguardia_e2e_test, prepared before it serves –
  // never the developer's server on 3000 nor its database. Not reused: a server already on 3100 fails the run.
  webServer: baseURL
    ? undefined
    : {
        command: "node --env-file-if-exists=.env.development.local --conditions=react-server --import tsx scripts/e2e-server.ts",
        url: `http://localhost:${E2E_PORT}`,
        reuseExistingServer: false,
        timeout: 180_000, // the first run compiles cold in .next-e2e
      },
});
