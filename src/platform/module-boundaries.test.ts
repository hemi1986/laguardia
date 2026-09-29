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
      'import { reportProblemCommand } from "@/modules/repair";\nexport const x = reportProblemCommand;\n',
    );
    const ownInternals = await boundaryErrors(
      "src/modules/repair/allowed.ts",
      'import { problemReport } from "./schema";\nexport const x = problemReport;\n',
    );

    expect(publicInterface).toEqual([]);
    expect(ownInternals).toEqual([]);
  });

  it("reject imports against the direction app → modules → platform", async () => {
    const platformImportsModule = await boundaryErrors(
      "src/platform/deliberate-violation.ts",
      'import { reportProblemCommand } from "@/modules/repair";\nexport const x = reportProblemCommand;\n',
    );
    const moduleImportsApp = await boundaryErrors(
      "src/modules/repair/deliberate-violation.ts",
      'import { enterSpike } from "@/app/actions";\nexport const x = enterSpike;\n',
    );
    const moduleImportsSpike = await boundaryErrors(
      "src/modules/repair/deliberate-violation.ts",
      'import { TEST_MACHINE_ID } from "@/spike/test-machine";\nexport const x = TEST_MACHINE_ID;\n',
    );

    expect(platformImportsModule).toHaveLength(1);
    expect(moduleImportsApp).toHaveLength(1);
    expect(moduleImportsSpike).toHaveLength(1);
  });

  it("reject a UI component reaching into the domain – and allow a page to use it", async () => {
    const intoAModule = await boundaryErrors(
      "src/components/ui/deliberate-violation.tsx",
      'import { logIn } from "@/modules/team";\nexport const x = logIn;\n',
    );
    const intoTheCatalogs = await boundaryErrors(
      "src/components/ui/deliberate-violation.tsx",
      'import { teamMessages } from "@/platform/messages";\nexport const x = teamMessages;\n',
    );
    const pageUsingAComponent = await boundaryErrors(
      "src/app/allowed.tsx",
      'import { Field } from "@/components/ui/field";\nexport const x = Field;\n',
    );

    expect(intoAModule).toHaveLength(1);
    expect(intoTheCatalogs).toHaveLength(1);
    expect(pageUsingAComponent).toHaveLength(0);
  });
});

