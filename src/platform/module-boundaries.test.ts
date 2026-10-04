import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

/** ADR 0002: a module is used only through its public interface (`index.ts`), never through its internals. */
const eslint = new ESLint({ cwd: process.cwd() });

/** Messages of the rule that keeps Role and Reporter defined once (architecture review Q5/Q20, ST-073). */
async function ruleErrors(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.ruleId === "no-restricted-syntax").map((m) => m.message);
}

/** Messages of the import restrictions of the Server Action runner (architecture review Q10, ST-073). */
async function importErrors(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.ruleId === "no-restricted-imports").map((m) => m.message);
}

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

  it("allow a test – and only a test – another module's test support, and nothing else of its internals", async () => {
    const importTestSupport =
      'import { retireMachineForTest } from "@/modules/collection/machines.test-support";\nexport const x = retireMachineForTest;\n';
    const importInternals = 'import { machines } from "@/modules/collection/machines";\nexport const x = machines;\n';

    expect(await boundaryErrors("src/app/deliberate.integration.test.ts", importTestSupport)).toEqual([]);
    expect(await boundaryErrors("src/modules/repair/deliberate.test.ts", importTestSupport)).toEqual([]);
    expect(await boundaryErrors("src/app/deliberate-violation.ts", importTestSupport)).toHaveLength(1);
    expect(await boundaryErrors("src/app/deliberate.integration.test.ts", importInternals)).toHaveLength(1);
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
    const platformImportsApp = await boundaryErrors(
      "src/platform/deliberate-violation.ts",
      'import { requireTeamMember } from "@/app/team-session";\nexport const x = requireTeamMember;\n',
    );
    const moduleImportsApp = await boundaryErrors(
      "src/modules/repair/deliberate-violation.ts",
      'import { requireTeamMember } from "@/app/team-session";\nexport const x = requireTeamMember;\n',
    );

    expect(platformImportsModule).toEqual([expect.stringContaining("The platform must not depend on modules")]);
    expect(platformImportsApp).toEqual([expect.stringContaining("The platform must not depend on modules")]);
    expect(moduleImportsApp).toEqual([expect.stringContaining("A module must not depend on the app")]);
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

  it("reject a second definition of Role or Reporter under src/ – and allow their one home", async () => {
    const secondRole = await ruleErrors(
      "src/modules/team/deliberate-duplicate.ts",
      "export type Role = \"helper\" | \"technician\";\n",
    );
    const secondReporter = await ruleErrors(
      "src/app/deliberate-duplicate.ts",
      "export interface Reporter {\n  kind: string;\n}\n",
    );
    const roleAtHome = await ruleErrors(
      "src/platform/command/index.ts",
      "export type Role = \"helper\" | \"technician\";\n",
    );
    const reporterAtHome = await ruleErrors(
      "src/modules/repair/report-problem.ts",
      "export type Reporter = { kind: \"visitor\" };\n",
    );

    expect(secondRole).toEqual([expect.stringContaining("src/platform/command")]);
    expect(secondReporter).toEqual([expect.stringContaining("src/modules/repair/report-problem.ts")]);
    expect(roleAtHome).toEqual([]);
    expect(reporterAtHome).toEqual([]);
  });

  it("reject executeCommand in the app outside the Server Action runner – by alias and by relative path", async () => {
    const importing = "import { executeCommand } from \"@/platform/command\";\nexport const x = executeCommand;\n";
    const byAlias = await importErrors("src/app/(team)/team/deliberate-violation/actions.ts", importing);
    const byRelativePath = await importErrors(
      "src/app/deliberate-violation.ts",
      "import { executeCommand } from \"../platform/command\";\nexport const x = executeCommand;\n",
    );
    const inTheRunner = await importErrors("src/app/_actions/allowed.ts", importing);
    const inATest = await importErrors("src/app/allowed.integration.test.ts", importing);
    const otherNames = await importErrors(
      "src/app/allowed.ts",
      "import { journalOf } from \"@/platform/command\";\nexport const x = journalOf;\n",
    );

    expect(byAlias).toEqual([expect.stringContaining("src/app/_actions/")]);
    expect(byRelativePath).toEqual([expect.stringContaining("src/app/_actions/")]);
    expect(inTheRunner).toEqual([]);
    expect(inATest).toEqual([]);
    expect(otherNames).toEqual([]);
  });

  it("reject building a runner with an own acting person outside the runner and its tests", async () => {
    const importing =
      "import { formRunner } from \"@/app/_actions/form-runner\";\nexport const x = formRunner;\n";

    expect(await importErrors("src/app/deliberate-violation/actions.ts", importing)).toEqual([
      expect.stringContaining("formAction"),
    ]);
    expect(await importErrors("src/app/_actions/run-form.ts", importing)).toEqual([]);
    expect(await importErrors("src/app/_actions/form-runner.integration.test.ts", importing)).toEqual([]);
  });

  it("treat the Server Action runner as part of the app element", async () => {
    const runnerIntoInternals = await boundaryErrors(
      "src/app/_actions/deliberate-violation.ts",
      "import { problemReport } from \"@/modules/repair/schema\";\nexport const x = problemReport;\n",
    );
    const moduleIntoRunner = await boundaryErrors(
      "src/modules/repair/deliberate-violation.ts",
      "import { currentPerson } from \"@/app/_actions/current-person\";\nexport const x = currentPerson;\n",
    );

    expect(runnerIntoInternals).toHaveLength(1);
    expect(moduleIntoRunner).toEqual([expect.stringContaining("app")]);
  });

  it("reject @vercel/blob anywhere under src/ but the Blob adapter of the storage seam (ST-016)", async () => {
    const importing = 'import { put } from "@vercel/blob";\nexport const x = put;\n';

    expect(await importErrors("src/photo/deliberate-violation.ts", importing)).toEqual([
      expect.stringContaining("storage seam"),
    ]);
    expect(await importErrors("src/app/deliberate-violation.ts", importing)).toEqual([
      expect.stringContaining("storage seam"),
    ]);
    expect(await importErrors("src/platform/storage/blob-storage.ts", importing)).toEqual([]);
  });

  it("reject importing the photo module's internals – only its public interface (ST-016)", async () => {
    const internals = 'import { acceptPhoto } from "@/photo/accept-photo";\nexport const x = acceptPhoto;\n';
    const publicInterface = 'import { PHOTO_LIMITS } from "@/photo";\nexport const x = PHOTO_LIMITS;\n';

    expect(await boundaryErrors("src/app/deliberate-violation.ts", internals)).toHaveLength(1);
    expect(await boundaryErrors("src/modules/repair/deliberate-violation.ts", internals)).toHaveLength(1);
    expect(await boundaryErrors("src/app/allowed.ts", publicInterface)).toEqual([]);
    expect(await boundaryErrors("src/photo/allowed.ts", internals.replace("@/photo/", "./"))).toEqual([]);
  });
});
