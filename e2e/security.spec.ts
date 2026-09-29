import { expect, test } from "./fixtures";

/**
 * The CSRF protection of ST-003 (`src/proxy.ts`), proven on the login page – public and with a real Server Action
 * (`logInAction`), so it runs against the preview without an account (ST-078 moved it off the spike page).
 */

// On the preview, the first navigation sets the deployment-protection bypass cookie that `page.request` then sends.
test.beforeEach(async ({ page }) => {
  await page.goto("/login");
});

// A forged cross-site form post, sent the way an attacker's page would: the form fields of the real login (including
// its Server Action ID) with the victim's cookies, but a foreign or missing Origin.
for (const [name, origin] of [
  ["a foreign origin", "https://attacker.example"],
  ["no origin", undefined],
] as const) {
  test(`a Server Action submitted with ${name} is rejected and creates no session`, async ({ page }) => {
    // The server-rendered HTML carries the form's action field (hydration removes it from the live page).
    const html = await (await page.request.get("/login")).text();
    const actionField = html.match(/name="(\$ACTION_ID_[0-9a-f]+)"/)?.[1];
    expect(actionField).toBeDefined();

    const response = await page.request.post("/login", {
      multipart: { [actionField!]: "", username: "forged", password: "forged-password-1" },
      headers: origin ? { origin } : {},
      maxRedirects: 0,
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.headers()["set-cookie"]).toBeUndefined();
    await page.goto("/team");
    await expect(page).toHaveURL(/\/login$/);
  });
}

// The control: the same post from the page's own origin reaches the action (a failed login redirects back), so the
// rejections above come from the Origin check – not from a stale action ID.
test("the same Server Action submitted from the page's own origin reaches the action", async ({ page, baseURL }) => {
  const html = await (await page.request.get("/login")).text();
  const actionField = html.match(/name="(\$ACTION_ID_[0-9a-f]+)"/)?.[1];

  const response = await page.request.post("/login", {
    multipart: { [actionField!]: "", username: `nobody_${Date.now().toString(36)}`, password: "wrong-password-1" },
    headers: { origin: new URL(baseURL!).origin },
    maxRedirects: 0,
  });

  expect(response.status()).toBeLessThan(400);
});

test("pages are served with the security headers", async ({ page }) => {
  const response = await page.goto("/login");
  const headers = response?.headers() ?? {};

  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["permissions-policy"]).toContain("geolocation=()");
});
