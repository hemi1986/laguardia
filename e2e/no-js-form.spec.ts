import { expect, openMore, test } from "./fixtures";

/**
 * The house select must submit without JavaScript (ST-076). shadcn's own select (Base UI) renders a `<button>`
 * trigger and a JavaScript-driven listbox with no native form control, so it was removed again and
 * `NativeSelect` is the house component for every field that must submit without JavaScript. This test runs the
 * whole flow with JavaScript switched off, so it fails if anyone swaps a form field for a scripted one.
 */
test.use({ javaScriptEnabled: false });

const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test("a technician creates a technician account with JavaScript disabled", async ({ page }) => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
  const newUsername = `nojs_${Date.now().toString(36)}`;

  await page.goto("/login");
  await page.getByLabel("Benutzername").fill(username!);
  await page.getByLabel("Passwort").fill(password!);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/team$/);

  await openMore(page);
  await page.getByRole("link", { name: "Teammitglieder" }).click();
  await page.getByLabel("Name", { exact: true }).fill(`No JS ${newUsername}`);
  await page.getByLabel("Benutzername").fill(newUsername);
  await page.getByLabel("Anfangspasswort").fill("nojs-secret-10");
  // Reachable by keyboard, not only by mouse – the point of a native control.
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Rolle")).toBeFocused();
  await page.getByLabel("Rolle").selectOption("technician");
  await page.getByRole("button", { name: "Konto anlegen" }).click();

  // The chosen role really arrived at the server – not the default "helper".
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Konto angelegt.");
  await expect(page.getByRole("article").filter({ hasText: newUsername })).toContainText("Techniker:in");
});
