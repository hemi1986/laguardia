import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { repositoryFiles } from "@/test-support/repository-files";

/**
 * ST-078 removed the scaffolding of the ST-001/ST-002 spikes. This scan fails when a reference to it comes back –
 * in code, browser tests, scripts or the repository's configuration (which lint and the type check do not read).
 */
const leftovers: { name: string; pattern: RegExp }[] = [
  { name: "the spike's test machine", pattern: /test-machine|TEST_MACHINE/ },
  { name: "the spike password", pattern: /SPIKE_PASSWORD/ },
  { name: "a spike address or import", pattern: /\/spike\b/ },
  { name: "the spike message block", pattern: /\bspike\s*:\s*\{|\.spike\b|\{\s*spike\s*\}/ },
];

/** The 404 checks must name the removed addresses, the migration test the spike rows, to prove they are gone. */
const allowed: Record<string, string[]> = {
  "e2e/home.spec.ts": ["a spike address or import"],
  "src/platform/migrations.integration.test.ts": ["the spike's test machine"],
};
const thisFile = "src/platform/spike-leftovers.test.ts";


function leftoversIn(file: string, text: string): string[] {
  return text
    .split("\n")
    .flatMap((line, index) =>
      leftovers
        .filter(({ name, pattern }) => pattern.test(line) && !allowed[file]?.includes(name))
        .map(({ name }) => `${file}:${index + 1}: ${name}`),
    );
}

describe("spike leftovers", () => {
  it("no code, browser test, script or configuration refers to the removed spike scaffolding", () => {
    const files = repositoryFiles(thisFile);

    expect(files).toContain("e2e/security.spec.ts");
    expect(files).toContain(".github/workflows/e2e-preview.yml");
    expect(files.flatMap((file) => leftoversIn(file, readFileSync(file, "utf8")))).toEqual([]);
  });

  it("finds each kind of leftover when it is added again", () => {
    expect(leftoversIn("src/app/page.tsx", 'import { TEST_MACHINE_ID } from "@/spike/test-machine";')).toEqual([
      "src/app/page.tsx:1: the spike's test machine",
      "src/app/page.tsx:1: a spike address or import",
    ]);
    expect(leftoversIn(".env.example", "\nSPIKE_PASSWORD=")).toEqual([".env.example:2: the spike password"]);
    expect(leftoversIn("e2e/x.spec.ts", 'await page.goto("/spike/files");')).toEqual([
      "e2e/x.spec.ts:1: a spike address or import",
    ]);
    expect(leftoversIn("src/app/page.tsx", "const { spike } = teamMessages;")).toEqual([
      "src/app/page.tsx:1: the spike message block",
    ]);
    expect(leftoversIn("e2e/home.spec.ts", 'const paths = ["/spike/photos"];')).toEqual([]);
  });
});
