import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { reportProblemCommand, untriagedProblemReportCount } from "@/modules/repair";
import { storedProblemReport } from "@/modules/repair/problem-report-stand-ins.test-support";
import { fixedClock } from "@/platform/clock";
import { formRunner } from "@/app/_actions/form-runner";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { teamReportProblemFields, teamReportProblemInput } from "./report-problem-input";

/**
 * A team member's problem report from the machine record (ST-015): the report form's fields and input function run
 * through the Server Action runner as the signed-in team member – what its Server Action does in a request.
 */
const db = testDatabase();
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;

function post(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  return form;
}

describe("the team's report form", () => {
  it("ST-015: Helper reports a problem", async () => {
    await anExistingTeamMember(db, anna, "Anna");
    const machineId = await aRegisteredMachine(db);
    const reported: string[] = [];
    const action = formRunner({
      currentPerson: async () => anna,
      db,
      clock: fixedClock("2026-10-03T16:00:00Z"),
      newId: randomUUID,
    })(reportProblemCommand, {
      fields: teamReportProblemFields,
      input: teamReportProblemInput,
      onSuccess: async ({ problemReportId }) => void reported.push(problemReportId),
    });

    expect(await action(null, post({ machineId, description: "Rubber on the left slingshot cracked" }))).toBeNull();

    expect(await storedProblemReport(db, reported[0])).toMatchObject({
      machineId,
      description: "Rubber on the left slingshot cracked",
      reporter: { kind: "team-member", teamMemberId: anna.teamMemberId },
    });
    // It waits for triage: until triage exists (ST-018) every problem report counts as untriaged.
    expect(await untriagedProblemReportCount(db, machineId)).toBe(1);
  });
});
