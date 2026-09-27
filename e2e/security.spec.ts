import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Spike-Passwort").fill(process.env.SPIKE_PASSWORD ?? "local");
  await page.getByRole("button", { name: "Weiter" }).click();
});

// A forged cross-site form post, sent the way an attacker's page would: the form fields of the real command
// (including its Server Action ID) with the victim's cookies, but a foreign or missing Origin.
for (const [name, origin] of [
  ["a foreign origin", "https://attacker.example"],
  ["no origin", undefined],
] as const) {
  test(`a command submitted with ${name} is rejected and stores nothing`, async ({ page }) => {
    const description = `Forged report with ${name} (browser test ${Date.now()})`;
    // The server-rendered HTML carries the form's action field (hydration removes it from the live page).
    const html = await (await page.request.get("/")).text();
    const actionField = html.match(/name="(\$ACTION_ID_[0-9a-f]+)"/)?.[1];
    expect(actionField).toBeDefined();

    const response = await page.request.post("/", {
      multipart: { [actionField!]: "", description },
      headers: origin ? { origin } : {},
      maxRedirects: 0,
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
    await page.reload();
    await expect(page.getByText(description)).toHaveCount(0);
  });
}

test("pages are served with the security headers", async ({ page }) => {
  const response = await page.goto("/");
  const headers = response?.headers() ?? {};

  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["permissions-policy"]).toContain("geolocation=()");
});
