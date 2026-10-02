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
