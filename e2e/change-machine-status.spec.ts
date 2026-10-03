import type { Page } from "@playwright/test";
import { expect, openMore, test } from "./fixtures";

/**
 * Changing the machine status on a phone (ST-012): from the machine record to its own page and back. Needs a
 * technician account: locally the e2e technician each local run creates (ST-083, E2E_TEAM_USERNAME /
 * E2E_TEAM_PASSWORD); the preview database has none before ST-068, so this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

function unique(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function logIn(page: Page, as = { username: username!, password: password! }) {
  await page.goto("/login");
  await page.getByLabel("Benutzername").fill(as.username);
  await page.getByLabel("Passwort").fill(as.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/team$/);
}

/** A machine model and a playable machine registered through the pages – returns the assigned museum number. */
async function aPlayableMachine(page: Page): Promise<string> {
  const title = unique("Medieval Madness");
  await page.goto("/team/machine-models");
  await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Hersteller").fill("Williams");
  await page.getByLabel("Kategorie").selectOption("pinball");
  await page.getByRole("button", { name: "Modell anlegen" }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.goto("/team/machines/new");
  await page.getByLabel("Modell").selectOption({ label: `${title} (Williams)` });
  await page.getByLabel("Standort").fill("Hall 2, row 3");
  await page.getByRole("button", { name: "Gerät erfassen" }).click();
  return (await page.getByRole("main").getByRole("status").textContent())!.match(/LG-\d{3}/)![0];
}

/** From the machine record to the status change, the way a team member gets there. */
async function openStatusChange(page: Page, museumNumber: string) {
  await page.goto(`/team/machines/${museumNumber}`);
  await page.getByRole("link", { name: "Status ändern" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Status von ${museumNumber} ändern`);
}

async function pageWidth(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

test("ST-012: A helper is offered only Außer Betrieb", async ({ page }) => {
  await logIn(page);
  const museumNumber = await aPlayableMachine(page);
  const helper = { username: unique("helper").replace(" ", "_"), password: "e2e-secret-10" };
  await page.goto("/team/members");
  await page.getByLabel("Name", { exact: true }).fill(`E2E ${helper.username}`);
  await page.getByLabel("Benutzername").fill(helper.username);
  await page.getByLabel("Anfangspasswort").fill(helper.password);
  await page.getByRole("button", { name: "Konto anlegen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Konto angelegt.");
  await openMore(page);
  await page.getByRole("button", { name: "Abmelden" }).click();
  await logIn(page, helper);

  await openStatusChange(page, museumNumber);

  const status = page.getByLabel("Status", { exact: true });
  await expect(status.locator("option")).toHaveText(["Außer Betrieb"]);
  await expect(status).toHaveValue("out-of-order");
  await expect(page.getByLabel("Grund")).toBeVisible();
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("ST-012: A rejected status change keeps what was chosen", async ({ page }) => {
  await logIn(page);
  const museumNumber = await aPlayableMachine(page);
  await openStatusChange(page, museumNumber);

  await page.getByLabel("Status", { exact: true }).selectOption("limited");
  await page.getByRole("button", { name: "Status ändern" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Bitte einen Grund angeben – er steht in der Status-Historie.",
  );
  await expect(page.getByLabel("Grund")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("limited");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("ST-012: After the change the team member sees the machine", async ({ page }) => {
  await logIn(page);
  const museumNumber = await aPlayableMachine(page);
  await openStatusChange(page, museumNumber);

  await page.getByLabel("Status", { exact: true }).selectOption("limited");
  await page.getByLabel("Grund").fill("left flipper weak");
  await page.getByRole("button", { name: "Status ändern" }).click();

  await expect(page).toHaveURL(new RegExp(`/team/machines/${museumNumber}\\?`));
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`${museumNumber} ist jetzt Eingeschränkt.`);
  const status = page
    .getByRole("main")
    .locator("dl div")
    .filter({ has: page.locator("dt", { hasText: "Status" }) });
  await expect(status).toContainText("Eingeschränkt");
  await expect(page.getByRole("main")).toContainText("Spielbereit → Eingeschränkt");
  await expect(page.getByRole("main")).toContainText("left flipper weak");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a status change is saved, and a rejected one keeps the chosen status", async ({ page }) => {
    await logIn(page);
    const museumNumber = await aPlayableMachine(page);
    await openStatusChange(page, museumNumber);

    await page.getByLabel("Status", { exact: true }).selectOption("not-on-display");
    await page.getByRole("button", { name: "Status ändern" }).click();
    await expect(page.getByLabel("Status", { exact: true })).toHaveValue("not-on-display");
    await page.getByLabel("Grund").fill("restoration");
    await page.getByRole("button", { name: "Status ändern" }).click();

    await expect(page.getByRole("main").getByRole("status")).toHaveText(`${museumNumber} ist jetzt Nicht ausgestellt.`);
  });
});
