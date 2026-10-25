import type { Page } from "@playwright/test";
import { expect, logIn, pageWidth, test, aMachine, aHelper } from "./fixtures";

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

/** A playable machine, registered by the e2e technician. Returns its museum number. */
async function aPlayableMachine(page: Page): Promise<string> {
  return (await aMachine(page)).museumNumber;
}

/** From the machine record to the status change, the way a team member gets there. */
async function openStatusChange(page: Page, museumNumber: string) {
  await page.goto(`/team/machines/${museumNumber}`);
  await page.getByRole("link", { name: "Status ändern" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Status von ${museumNumber} ändern`);
}

test("ST-012: A helper is offered only Außer Betrieb", async ({ page }) => {
  await logIn(page);
  const museumNumber = await aPlayableMachine(page);
  const helper = await aHelper(page);
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
