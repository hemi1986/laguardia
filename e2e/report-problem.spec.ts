import { expect, test } from "@playwright/test";

test("a visitor reports a problem for the test machine on a 360 px phone", async ({ page }) => {
  const description = `Left flipper is weak (browser test ${Date.now()})`;

  await page.goto("/");
  await page.getByLabel("Spike-Passwort").fill(process.env.SPIKE_PASSWORD ?? "local");
  await page.getByRole("button", { name: "Weiter" }).click();

  await page.getByLabel("Problem melden").fill(description);
  await page.getByRole("button", { name: "Melden" }).click();

  await expect(page.getByText(description)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
