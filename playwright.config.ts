import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests at phone size (360 px, Definition of Done). BASE_URL points at a deployed preview (CI);
 * without it they run against a local dev server. Previews sit behind Vercel's deployment protection –
 * the automation bypass secret lets the tests through.
 */
const baseURL = process.env.BASE_URL;
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 360, height: 800 },
    isMobile: true,
    hasTouch: true,
    baseURL: baseURL ?? "http://localhost:3000",
    extraHTTPHeaders: bypass ? { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" } : {},
    trace: "retain-on-failure",
  },
  webServer: baseURL ? undefined : { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true },
});
