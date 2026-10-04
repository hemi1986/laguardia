import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { reportProblemCommand, untriagedProblemReportCount } from "@/modules/repair";
import { storedProblemReport } from "@/modules/repair/problem-report-stand-ins.test-support";
import { fixedClock } from "@/platform/clock";
import { formRunner, photoFormRunner } from "@/app/_actions/form-runner";
import sharp from "sharp";
import { memoryStorage } from "@/platform/storage";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { teamReportProblemFields, teamReportProblemInput, teamReportProblemPhoto } from "./report-problem-input";

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
      input: (fields) => teamReportProblemInput(fields, machineId),
      onSuccess: async ({ problemReportId }) => void reported.push(problemReportId),
    });

    expect(await action(null, post({ description: "Rubber on the left slingshot cracked" }))).toBeNull();

    expect(await storedProblemReport(db, reported[0])).toMatchObject({
      machineId,
      description: "Rubber on the left slingshot cracked",
      reporter: { kind: "team-member", teamMemberId: anna.teamMemberId },
    });
    // It waits for triage: until triage exists (ST-018) every problem report counts as untriaged.
    expect(await untriagedProblemReportCount(db, machineId)).toBe(1);
  });

  it("ST-016: Team member adds a photo", async () => {
    const hanna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
    await anExistingTeamMember(db, hanna, "Hanna");
    const machineId = await aRegisteredMachine(db);
    const storage = memoryStorage();
    const reported: string[] = [];
    const action = photoFormRunner({
      currentPerson: async () => hanna,
      db,
      clock: fixedClock("2026-10-04T10:00:00Z"),
      newId: randomUUID,
      storage,
    })(reportProblemCommand, {
      fields: teamReportProblemFields,
      photo: teamReportProblemPhoto,
      input: (fields, photo) => teamReportProblemInput(fields, machineId, photo),
      onSuccess: async ({ problemReportId }) => void reported.push(problemReportId),
    });
    // An existing photo chosen from the phone's gallery – sent as the browser prepared it.
    const chosen = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#3c78c8" } })
      .jpeg()
      .toBuffer();
    const form = post({ description: "Coil on the right flipper smells burnt" });
    form.append("photo", new File([Uint8Array.from(chosen)], "IMG_0042.jpg", { type: "image/jpeg" }));

    expect(await action(null, form)).toBeNull();

    expect(storage.names()).toHaveLength(1);
    expect(await storedProblemReport(db, reported[0])).toMatchObject({
      reporter: { kind: "team-member", teamMemberId: hanna.teamMemberId },
      photo: storage.names()[0],
    });
  });
});
