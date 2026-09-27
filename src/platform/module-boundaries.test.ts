import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

/** ADR 0002: a module is used only through its public interface (`index.ts`), never through its internals. */
const eslint = new ESLint({ cwd: process.cwd() });

async function boundaryErrors(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.ruleId?.startsWith("boundaries/")).map((m) => m.message);
}

describe("module boundaries", () => {
  it("reject a module importing another module's internals – by alias and by relative path", async () => {
    const byAlias = await boundaryErrors(
      "src/modules/collection/deliberate-violation.ts",
      'import { problemReport } from "@/modules/repair/schema";\nexport const x = problemReport;\n',
    );
    const byRelativePath = await boundaryErrors(
      "src/modules/collection/deliberate-violation.ts",
      'import { problemReport } from "../repair/schema";\nexport const x = problemReport;\n',
    );

    expect(byAlias).toHaveLength(1);
    expect(byRelativePath).toHaveLength(1);
  });

  it("reject the app importing a module's internals", async () => {
    const errors = await boundaryErrors(
      "src/app/deliberate-violation.ts",
      'import { problemReport } from "@/modules/repair/schema";\nexport const x = problemReport;\n',
    );

    expect(errors).toHaveLength(1);
  });

  it("allow another module's public interface and a module's own internals", async () => {
    const publicInterface = await boundaryErrors(
      "src/modules/collection/allowed.ts",
      'import { reportProblem } from "@/modules/repair";\nexport const x = reportProblem;\n',
    );
    const ownInternals = await boundaryErrors(
      "src/modules/repair/allowed.ts",
      'import { problemReport } from "./schema";\nexport const x = problemReport;\n',
    );

    expect(publicInterface).toEqual([]);
    expect(ownInternals).toEqual([]);
  });
});
