import { existsSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

/**
 * Browser tests at phone size (360 px, Definition of Done). BASE_URL points at a deployed preview (CI);
 * without it they run against a local dev server. Previews sit behind Vercel's deployment protection –
 * the automation bypass secret lets the tests through (sent only to the preview, see e2e/fixtures.ts).
 *
 * No traces, screenshots or videos in CI: the repository is public and they would contain the bypass secret
 * and the spike password. Locally, failed tests keep a trace.
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
    baseURL: baseURL ?? "http://localhost:3000",
    trace: process.env.CI ? "off" : "retain-on-failure",
    screenshot: "off",
    video: "off",
  },
  webServer: baseURL ? undefined : { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true },
});
