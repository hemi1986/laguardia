import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  defectDetails,
  linkProblemReportToDefectCommand,
  problemReportForTriage,
  reportProblemCommand,
} from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aDefectWithHistory } from "@/test-support/defects";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadTriageConfirmation, triageConfirmationText } from "../../../triage-confirmation";
import { loadProblemReport } from "../problem-report-data";
import { linkToDefectInput } from "./link-to-defect-input";

/**
 * „Mit Defekt verknüpfen“ on a recently resolved defect (ST-053): the form posts the defect with the version its page
 * showed, linking reopens it (POL-LinkReopensResolvedDefect), and the triage list confirms both.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-15T10:00:00Z");
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

describe("„Mit Defekt verknüpfen“ on a resolved defect", () => {
  it("ST-053: Linking a problem report to a resolved defect reopens it", async () => {
    await anExistingTeamMember(db, eva, "Eva");
    const defect = await aDefectWithHistory(db, { by: eva, recordedAt: "2026-10-01T10:00:00Z" });
    await defect.logWork("2026-10-02T10:00:00Z");
    await defect.resolve("2026-10-12T10:00:00Z");
    const reported = await executeCommand(
      reportProblemCommand,
      { machineId: defect.machineId, description: "Left flipper does nothing again" },
      { actor: { kind: "visitor" }, db, clock, newId: randomUUID },
    );
    if (!reported.ok) throw new Error(reported.error);
    const { problemReportId } = reported.result;
    // The form as its page shows it: the resolved defect with the version shown, chosen.
    const page = await loadProblemReport(db, clock, problemReportId);
    const offered = page?.defectsToLinkTo.recentlyResolved ?? [];
    const fields = {
      version: String(page?.version),
      defectId: defect.defectId,
      resolvedDefects: offered.map((entry) => `${entry.id}:${entry.version}`).join(" "),
      machineStatus: "",
      machineVersion: "0",
    };

    const linked = await executeCommand(linkProblemReportToDefectCommand, linkToDefectInput(fields, problemReportId), {
      actor: eva,
      db,
      clock,
      newId: randomUUID,
    });

    expect(linked).toMatchObject({ ok: true });
    expect(await problemReportForTriage(db, clock, problemReportId)).toMatchObject({
      triageOutcome: "linked",
      triagedBy: eva.teamMemberId,
    });
    expect(await defectDetails(db, defect.defectId)).toMatchObject({
      state: "open",
      hold: undefined,
      claim: undefined,
      reopenings: [
        {
          problemReport: { id: problemReportId, description: "Left flipper does nothing again" },
          reopenedBy: eva.teamMemberId,
        },
      ],
    });
    const confirmation = await loadTriageConfirmation(db, clock, eva.teamMemberId, { linked: problemReportId });
    expect(confirmation && triageConfirmationText(confirmation)).toMatch(
      /^Meldung zu .+ mit Defekt „Left flipper weak“ verknüpft\. Der Defekt ist wieder offen\.$/,
    );
  });
});
