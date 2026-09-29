import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function enterSpike(page: Page) {
  await page.goto("/");
  await page.getByLabel("Spike-Passwort").fill(process.env.SPIKE_PASSWORD ?? "local");
  await page.getByRole("button", { name: "Weiter" }).click();
}

async function pageWidth(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

test("a visitor reports a problem for the test machine on a 360 px phone", async ({ page }) => {
  const description = `Left flipper is weak (browser test ${Date.now()})`;

  await enterSpike(page);
  await page.getByLabel("Problem melden").fill(description);
  await page.getByRole("button", { name: "Melden" }).click();

  await expect(page.getByText(description)).toBeVisible();
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

/** ST-073 (Q9): a rejected command shows the catalogue text of its error code and keeps what the person typed. */
test("a description of only spaces shows the catalogue text and keeps the input on a 360 px phone", async ({ page }) => {
  await enterSpike(page);
  await page.getByLabel("Problem melden").fill("   ");
  await page.getByRole("button", { name: "Melden" }).click();

  const error = page.getByRole("main").getByRole("alert");
  await expect(error).toHaveText("Bitte beschreibe das Problem.");
  await expect(page.getByLabel("Problem melden")).toHaveValue("   ");
  await expect(error).toBeInViewport();
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test.describe("with JavaScript disabled", () => {
  test.use({ javaScriptEnabled: false });

  test("a description of only spaces shows the catalogue text and keeps the input", async ({ page }) => {
    await enterSpike(page);
    await page.getByLabel("Problem melden").fill("   ");
    await page.getByRole("button", { name: "Melden" }).click();

    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte beschreibe das Problem.");
    await expect(page.getByLabel("Problem melden")).toHaveValue("   ");
    expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  });
});
