import { test as base } from "@playwright/test";

/**
 * The Vercel deployment protection bypass header goes only to requests for the preview itself,
 * never to other origins the page may contact.
 */
export const test = base.extend({
  page: async ({ page, baseURL }, provide) => {
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    if (bypass && baseURL) {
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
    await provide(page);
  },
});

export { expect } from "@playwright/test";
