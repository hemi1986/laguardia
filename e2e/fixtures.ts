import { test as base, expect, type Page } from "@playwright/test";

/**
 * The Vercel deployment protection bypass header goes only to requests for the preview itself,
 * never to other origins the page may contact. Every page needs it – the test's own `page` gets it from the fixture,
 * a page of another browser context (e.g. a second visitor's phone, ST-010) through this function.
 */
export async function allowPreview(page: Page, baseURL: string | undefined): Promise<void> {
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!bypass || !baseURL) return;
  await page.route(`${new URL(baseURL).origin}/**`, (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        "x-vercel-protection-bypass": bypass,
        "x-vercel-set-bypass-cookie": "true",
      },
    }),
  );
}

export const test = base.extend({
  page: async ({ page, baseURL }, provide) => {
    await allowPreview(page, baseURL);
    await provide(page);
  },
});

export { expect } from "@playwright/test";

/**
 * Opens "Mehr" in the team navigation (ST-008): the managing destinations live behind it. Tests that assert a
 * destination is *missing* must open it first – a closed `<details>` hides its links anyway.
 */
export async function openMore(page: import("@playwright/test").Page) {
  const more = page.getByRole("navigation").locator("details");
  if ((await more.getAttribute("open")) === null) await more.locator("summary").click();
  await expect(more).toHaveAttribute("open", "");
}

/**
 * An untriaged problem report for a machine on display, reported the way a visitor does – on a phone of its own,
 * without a team session. Browser tests arrange their untriaged problem reports this way: a technician's own problem
 * report is triaged in the same step and never waits for triage (ST-023).
 */
export async function reportAsVisitor(page: Page, museumNumber: string, description: string): Promise<void> {
  const context = await page
    .context()
    .browser()!
    .newContext({
      locale: "de-DE",
      viewport: { width: 360, height: 800 },
      isMobile: true,
    });
  const phone = await context.newPage();
  await allowPreview(phone, base.info().project.use.baseURL);
  await phone.goto(`/m/${museumNumber}/melden`);
  await phone.getByLabel("Was ist das Problem?").fill(description);
  await phone.getByRole("button", { name: "Meldung senden" }).click();
  await expect(phone).toHaveURL(new RegExp(`/m/${museumNumber}\\?`)); // stored before the test goes on
  await context.close();
}
