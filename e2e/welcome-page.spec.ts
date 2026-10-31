import { allowPreview, aMachine, expect, logIn, pageWidth, test } from "./fixtures";

/**
 * The welcome page with the machines on display (ST-101) on a phone. What the list holds, its order, its texts and its
 * empty states are tested at the page's integration test; here a team member and a visitor see the same page. Switches
 * the listing on for the browser tests' database (the museum name stays as it is) – no test expects it off. Needs the
 * e2e technician each local run creates (ST-083), so this runs locally only.
 */
test.use({ locale: "de-DE" });

test.beforeEach(() => {
  test.skip(
    !process.env.E2E_TEAM_USERNAME || !process.env.E2E_TEAM_PASSWORD || !!process.env.BASE_URL,
    "needs a local technician account",
  );
});

test("ST-101: Team members see the same welcome page", async ({ page, browser }) => {
  await logIn(page);
  const machine = await aMachine(page, "out-of-order", "Halle 2, Reihe 3");
  await page.goto("/team/museum-settings");
  const listed = page.getByLabel("Geräteliste auf der Startseite anzeigen");
  if (!(await listed.isChecked())) {
    await listed.check();
    await page.getByRole("button", { name: "Museum speichern" }).click();
    await expect(page).toHaveURL(/saved=museum/);
  }

  await page.goto("/");
  const teamEntry = page.getByRole("link").filter({ hasText: machine.title });
  await expect(teamEntry).toHaveText(`${machine.title}Halle 2, Reihe 3Außer Betrieb`);
  await expect(page.getByText("Etwas funktioniert nicht? Gerät antippen und Problem melden.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Anmeldung fürs Team" })).toBeVisible();
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  const visitorPhone = await (await browser.newContext({ locale: "de-DE" })).newPage();
  await allowPreview(visitorPhone, test.info().project.use.baseURL);
  await visitorPhone.goto("/");
  const visitorEntry = visitorPhone.getByRole("link").filter({ hasText: machine.title });
  await expect(visitorEntry).toHaveText(`${machine.title}Halle 2, Reihe 3Außer Betrieb`);
  // The whole list is not compared: browser tests running beside this one register machines of their own meanwhile.
  await expect(visitorPhone.getByRole("heading", { level: 1 })).toHaveText(
    (await page.getByRole("heading", { level: 1 }).textContent()) ?? "",
  );
  await expect(visitorPhone.getByText("Etwas funktioniert nicht? Gerät antippen und Problem melden.")).toBeVisible();
  await expect(visitorPhone.getByRole("link", { name: "Anmeldung fürs Team" })).toBeVisible();

  await visitorEntry.click();
  await expect(visitorPhone).toHaveURL(new RegExp(`/m/${machine.museumNumber}$`));
  await expect(visitorPhone.getByRole("link", { name: "Problem melden" })).toBeVisible();
  await visitorPhone.context().close();
});
