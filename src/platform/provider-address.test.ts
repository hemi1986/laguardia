import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * ST-060: the provider's default address (`*.vercel.app`) is used in no link – stickers, pages and the login take the
 * museum's own domain (`docs/architecture/qr-address.md`). The login's address comes from Vercel's environment
 * (`VERCEL_PROJECT_PRODUCTION_URL` is the custom domain once one exists), never from a written-down address. This
 * scan fails when one comes back in code, browser tests, scripts or configuration.
 */
const PROVIDER_ADDRESS = /[a-z0-9-]+\.vercel\.app/i;

/** Everything in the repository but the discovery artifacts, the tooling and the generated migrations. */
const notScanned = /^(docs|\.claude|drizzle)\/|\.(png|jpe?g|ico|webp|svg|woff2?)$/;
const thisFile = "src/platform/provider-address.test.ts";

function repositoryFiles(): string[] {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
    .split("\n")
    .filter((file) => file && file !== thisFile && !notScanned.test(file));
}

function providerAddressesIn(file: string, text: string): string[] {
  return text
    .split("\n")
    .flatMap((line, index) => (PROVIDER_ADDRESS.test(line) ? [`${file}:${index + 1}`] : []));
}

describe("the provider's default address", () => {
  it("is written down nowhere – no link, no configuration, no test points to *.vercel.app", () => {
    const files = repositoryFiles();

    expect(files).toContain("next.config.ts");
    expect(files.flatMap((file) => providerAddressesIn(file, readFileSync(file, "utf8")))).toEqual([]);
  });

  it("is found when it is added again", () => {
    expect(providerAddressesIn("src/app/page.tsx", 'const url = "https://laguardia.vercel.app/m/LG-042";')).toEqual([
      "src/app/page.tsx:1",
    ]);
    expect(providerAddressesIn("src/app/page.tsx", 'const url = "https://eschbach.michaelschempp.de/m/LG-042";')).toEqual(
      [],
    );
  });
});
