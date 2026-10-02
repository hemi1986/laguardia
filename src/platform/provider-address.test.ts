import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { repositoryFiles } from "@/test-support/repository-files";

/**
 * ST-060: the provider's default address (`*.vercel.app`) is used in no link – stickers, pages and the login take the
 * museum's own domain (`docs/architecture/qr-address.md`). The login's address comes from Vercel's environment
 * (`VERCEL_PROJECT_PRODUCTION_URL` is the custom domain once one exists), never from a written-down address. This
 * scan fails when one comes back in code, browser tests, scripts or configuration.
 */
/** Also a built-up one – `https://${project}.vercel.app`, ".vercel.app" (ST-060 code review #6). */
const PROVIDER_ADDRESS = /\.vercel\.app\b/i;

const thisFile = "src/platform/provider-address.test.ts";


function providerAddressesIn(file: string, text: string): string[] {
  return text
    .split("\n")
    .flatMap((line, index) => (PROVIDER_ADDRESS.test(line) ? [`${file}:${index + 1}`] : []));
}

describe("the provider's default address", () => {
  it("is written down nowhere – no link, no configuration, no test points to *.vercel.app", () => {
    const files = repositoryFiles(thisFile);

    expect(files).toContain("next.config.ts");
    expect(files).toContain("e2e/fixtures.ts");
    expect(files).toContain(".github/workflows/e2e-preview.yml");
    expect(files.flatMap((file) => providerAddressesIn(file, readFileSync(file, "utf8")))).toEqual([]);
  });

  it("is found when it is added again", () => {
    expect(providerAddressesIn("src/app/page.tsx", 'const url = "https://laguardia.vercel.app/m/LG-042";')).toEqual([
      "src/app/page.tsx:1",
    ]);
    expect(providerAddressesIn("scripts/x.ts", "const url = `https://${project}.vercel.app`;")).toEqual(["scripts/x.ts:1"]);
    expect(providerAddressesIn("src/app/page.tsx", 'const url = "https://eschbach.michaelschempp.de/m/LG-042";')).toEqual(
      [],
    );
  });
});
