import { anOpenDefect, expect, logIn, openDefect, pageWidth, test } from "./fixtures";

/**
 * Reopening a resolved defect on a phone (ST-030): resolve it, then „Wieder öffnen“ under its closing note → the form
 * page → back on the defect's page, which confirms it and says who reopened it and why, after the closing note. Needs
 * the e2e technician each local run creates (ST-083); runs locally only, like the other defect specs.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

test("a technician reopens a resolved defect: asked for a reason, then the page says why it is open again", async ({
  page,
}) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page);
  await openDefect(page, museumNumber, title);
  const main = page.getByRole("main");
  await main.getByRole("link", { name: "Beheben" }).click();
  await page.getByLabel("Abschlussnotiz").fill("Coil replaced");
  await main.getByRole("button", { name: "Als behoben eintragen" }).click();
  await expect(main.getByRole("status")).toHaveText(`Du hast „${title}“ behoben.`);

  await main.getByRole("link", { name: "Wieder öffnen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Defekt wieder öffnen · ${museumNumber}`);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  await expect(page.getByLabel("Status")).toHaveValue("");

  // No reason: asked for, the chosen status is kept (G8).
  await page.getByLabel("Status").selectOption({ label: "Eingeschränkt" });
  await main.getByRole("button", { name: "Wieder öffnen" }).click();
  await expect(main.getByRole("alert")).toHaveText("Bitte angeben, warum der Defekt wieder geöffnet wird.");
  await expect(page.getByLabel("Status")).toHaveValue("limited");

  await page.getByLabel("Warum wieder öffnen?").fill("Weak again after an hour of play");
  await main.getByRole("button", { name: "Wieder öffnen" }).click();
  await expect(main.getByRole("status")).toHaveText(`„${title}“ ist wieder offen. ${museumNumber} ist jetzt Eingeschränkt.`);
  await expect(main).toContainText("Coil replaced");
  await expect(main).toContainText(/Wieder geöffnet von E2E Technician am/);
  await expect(main).toContainText("Weak again after an hour of play");
  await expect(main).toContainText("offen seit");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});
