import type { Page } from "@playwright/test";
import { expect, logIn, test } from "./fixtures";

/**
 * The CSRF protection of ST-003 (`src/proxy.ts`), proven on the login page – public and with a real Server Action
 * (`logInAction`), so it runs against the preview without an account (ST-078 moved it off the spike page).
 */

// On the preview, the first navigation sets the deployment-protection bypass cookie that `page.request` then sends.
test.beforeEach(async ({ page }) => {
  await page.goto("/login");
});

/**
 * The hidden fields that name the login's Server Action – what a browser without JavaScript posts with the form. The
 * server-rendered HTML carries them (hydration removes them from the live page).
 */
async function serverActionFields(page: Page): Promise<Record<string, string>> {
  const html = await (await page.request.get("/login")).text();
  const fields: Record<string, string> = {};
  for (const [input] of html.matchAll(/<input[^>]*name="\$ACTION[^"]*"[^>]*>/g)) {
    const name = input.match(/name="([^"]*)"/)![1];
    const value = input.match(/value="([^"]*)"/)?.[1] ?? "";
    fields[name] = value.replaceAll("&quot;", '"').replaceAll("&amp;", "&");
  }
  expect(Object.keys(fields).length).toBeGreaterThan(0);
  return fields;
}

// A forged cross-site form post, sent the way an attacker's page would: the form fields of the real login (including
// its Server Action ID) with the victim's cookies, but a foreign or missing Origin.
for (const [name, origin] of [
  ["a foreign origin", "https://attacker.example"],
  ["no origin", undefined],
] as const) {
  test(`a Server Action submitted with ${name} is rejected and creates no session`, async ({ page }) => {
    const actionFields = await serverActionFields(page);

    const response = await page.request.post("/login", {
      multipart: { ...actionFields, username: "forged", password: "forged-password-1" },
      headers: origin ? { origin } : {},
      maxRedirects: 0,
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.headers()["set-cookie"]).toBeUndefined();
    await page.goto("/team");
    await expect(page).toHaveURL(/\/login$/);
  });
}

// The control: the same post from the page's own origin reaches the action (a failed login redirects back), so the
// rejections above come from the Origin check – not from a stale action ID.
test("the same Server Action submitted from the page's own origin reaches the action", async ({ page, baseURL }) => {
  const actionFields = await serverActionFields(page);
  const username = `nobody_${Date.now().toString(36)}`;

  const response = await page.request.post("/login", {
    multipart: { ...actionFields, username, password: "wrong-password-1" },
    headers: { origin: new URL(baseURL!).origin },
    maxRedirects: 0,
  });

  // The login action ran: an unknown account gets the login page back with the rejection and the username it typed
  // (the login keeps its input since the backlog grooming of 2026-10-11 – before, it redirected with an error code).
  expect(response.status()).toBe(200);
  const answer = await response.text();
  expect(answer).toContain("Anmeldung fehlgeschlagen.");
  expect(answer).toContain(`value="${username}"`);
  expect(response.headers()["set-cookie"] ?? "").not.toContain("session");
});

test("pages are served with the security headers", async ({ page }) => {
  const response = await page.goto("/login");
  const headers = response?.headers() ?? {};

  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["permissions-policy"]).toContain("geolocation=()");
});

/**
 * The script policy of ST-070 (`src/proxy.ts`): every page response carries exactly one Content Security Policy with a
 * fresh nonce. `'unsafe-eval'` belongs only to `next dev` – the local browser tests run there, the preview never does.
 */
const onPreview = !!process.env.BASE_URL;

/** The Content Security Policy headers of a page response – exactly one is expected. */
async function policiesOf(page: Page, path: string): Promise<string[]> {
  const response = await page.request.get(path);
  return response
    .headersArray()
    .filter(({ name }) => name.toLowerCase() === "content-security-policy")
    .map(({ value }) => value);
}

/** The sources of one directive of a policy. */
function directive(policy: string, name: string): string[] {
  const found = policy
    .split(";")
    .map((part) => part.trim().split(/\s+/))
    .find(([directiveName]) => directiveName === name);
  return found?.slice(1) ?? [];
}

const publicPages = ["/", "/login", "/datenschutz", "/m/LG-999", "/m/LG-999/melden"];

// Opened in the browser, not only fetched: the fixture's watch sees each page render under the policy (on the preview:
// the production policy).
test("every page carries exactly one script policy with a nonce and 'strict-dynamic'", async ({ page }) => {
  for (const path of publicPages) {
    const response = await page.goto(path);
    const policies = ((await response?.headersArray()) ?? [])
      .filter(({ name }) => name.toLowerCase() === "content-security-policy")
      .map(({ value }) => value);
    expect(policies, path).toHaveLength(1);
    const scripts = directive(policies[0], "script-src");
    expect(scripts, path).toContain("'self'");
    expect(scripts, path).toContain("'strict-dynamic'");
    expect(
      scripts.some((source) => /^'nonce-[A-Za-z0-9+/]{22}==\'$/.test(source)),
      path,
    ).toBe(true);
    expect(scripts, path).not.toContain("'unsafe-inline'");
    if (onPreview) expect(scripts, path).not.toContain("'unsafe-eval'");
  }
});

test("team pages carry the same script policy", async ({ page }) => {
  test.skip(!process.env.E2E_TEAM_USERNAME || onPreview, "needs a local technician account");
  await logIn(page);
  for (const path of ["/team", "/team/machines", "/team/machines/new"]) {
    const policies = await policiesOf(page, path);
    expect(policies, path).toHaveLength(1);
    expect(
      directive(policies[0], "script-src").some((source) => source.startsWith("'nonce-")),
      path,
    ).toBe(true);
  }
});

test("two requests for the same page get different nonces", async ({ page }) => {
  const nonceOf = async () =>
    directive((await policiesOf(page, "/login"))[0], "script-src").find((source) => source.startsWith("'nonce-"));

  const first = await nonceOf();
  const second = await nonceOf();

  expect(first).toBeDefined();
  expect(second).toBeDefined();
  expect(first).not.toBe(second);
});

test("the policy keeps the ST-003 protection and allows styles only with the nonce", async ({ page }) => {
  const [policy] = await policiesOf(page, "/login");
  const nonce = directive(policy, "script-src").find((source) => source.startsWith("'nonce-"));

  expect(directive(policy, "frame-ancestors")).toEqual(["'none'"]);
  expect(directive(policy, "object-src")).toEqual(["'none'"]);
  expect(directive(policy, "base-uri")).toEqual(["'self'"]);
  expect(directive(policy, "form-action")).toEqual(["'self'"]);
  expect(directive(policy, "default-src")).toEqual(["'self'"]);
  // Photos and uploads reach only this deployment's private Blob store and Blob's upload API – no wildcard (on the
  // preview the store comes from BLOB_STORE_ID, locally from the Development store's token).
  const store = /^https:\/\/[a-z0-9]+\.private\.blob\.vercel-storage\.com$/;
  const images = directive(policy, "img-src");
  expect(images.slice(0, 3)).toEqual(["'self'", "blob:", "data:"]);
  expect(images.slice(3)).toHaveLength(1);
  expect(images[3]).toMatch(store);
  const connections = directive(policy, "connect-src");
  expect(connections).toEqual(["'self'", images[3], "https://vercel.com/api/blob/"]);
  // `next dev` allows inline `<style>` for its dev tools – the preview never does.
  expect(directive(policy, "style-src")).toEqual(onPreview ? ["'self'", nonce] : ["'self'", "'unsafe-inline'"]);
});

// Injected the way stored cross-site scripting would arrive: as markup in the server's HTML, past output encoding.
test.describe(() => {
  test.use({ policyViolationsExpected: true });

  test("an injected inline script without the nonce does not run and is reported as a violation", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (message.type() === "error" && text.includes("Content Security Policy") && text.includes("script-src"))
        violations.push(text);
    });
    await page.route("**/login", async (route) => {
      const response = await route.fetch();
      const html = (await response.text()).replace("</body>", "<script>window.injected = true;</script></body>");
      await route.fulfill({ response, body: html });
    });

    await page.goto("/login");

    expect(await page.evaluate(() => (window as { injected?: boolean }).injected)).toBeUndefined();
    await expect.poll(() => violations.length).toBeGreaterThan(0);
  });
});
