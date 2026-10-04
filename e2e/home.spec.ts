import { expect, test } from "./fixtures";

/**
 * The start page after the spike scaffolding is gone (ST-078): a minimal public page with the museum's name, a link to
 * the team login and the legal links (ST-064).
 * Runs against the preview too: it needs no account and no data. A German browser – the start page follows the
 * visitor's language since ST-010.
 */
test.use({ locale: "de-DE" });

test("the start page shows the museum's name and a link to the team login, without a redirect, on a 360 px phone", async ({
  page,
}) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Flipper- & Arcade Museum Eschbach" })).toBeVisible();
  await expect(page.getByLabel("Spike-Passwort")).toHaveCount(0);
  await expect(page.getByText(/Spike/)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  await page.getByRole("link", { name: "Anmeldung fürs Team" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

for (const path of ["/spike", "/spike/files", "/spike/photos", "/api/spike", "/api/spike/upload"]) {
  test(`the removed spike address ${path} is not found`, async ({ page }) => {
    await page.goto("/"); // on the preview, sets the deployment-protection bypass cookie that page.request sends
    const response = await page.request.get(path, { maxRedirects: 0 });

    expect(response.status()).toBe(404);
  });
}
