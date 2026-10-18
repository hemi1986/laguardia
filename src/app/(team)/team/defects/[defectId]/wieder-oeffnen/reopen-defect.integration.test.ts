import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { claimDefectCommand, resolveDefectCommand } from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { anOpenDefectIn } from "@/test-support/defects";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadDefectForReopening } from "./reopen-defect-data";
import { ReopenDefectForm } from "./reopen-defect-form";

/**
 * The form „Defekt wieder öffnen“ (ST-030): its page's data – the defect and, for technicians only, the machine status
 * choice of POL-DefectMayChangeMachineStatus – rendered by its form.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-14T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const asTom = { id: tom.teamMemberId, role: tom.role };
const asAnna = { id: anna.teamMemberId, role: anna.role };

async function aResolvedDefect() {
  const { defectId } = await anOpenDefectIn(db, { title: "Left flipper weak", recordedBy: tom, at: clock });
  const claimed = await executeCommand(claimDefectCommand, { defectId, version: 0 }, { actor: tom, db, clock });
  if (!claimed.ok) throw new Error(claimed.error);
  const resolved = await executeCommand(
    resolveDefectCommand,
    { defectId, version: 1, closingNote: "Coil replaced" },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!resolved.ok) throw new Error(resolved.error);
  return defectId;
}

async function formAs(defectId: string, viewer: typeof asTom | typeof asAnna) {
  const details = await loadDefectForReopening(db, defectId, viewer);
  if (!details) throw new Error("no such defect");
  const html = renderToStaticMarkup(
    createElement(ReopenDefectForm, {
      action: async () => null,
      version: details.version,
      whyNot: details.whyNot,
      museumNumber: details.museumNumber,
      machine: details.machine,
    }),
  );
  return { details, html };
}

beforeAll(async () => {
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, anna, "Anna");
});

describe("the form „Defekt wieder öffnen“", () => {
  it("ST-030: Helpers cannot change the machine status while reopening", async () => {
    const defectId = await aResolvedDefect();

    const annas = await formAs(defectId, asAnna);
    expect(annas.details.machine).toBeUndefined();
    expect(annas.html).toContain("Warum wieder öffnen?");
    expect(annas.html).not.toContain('name="machineStatus"');

    // A technician is offered the stricter statuses, „Status nicht ändern“ preselected (ST-018's wording).
    const toms = await formAs(defectId, asTom);
    expect(toms.details.machine).toMatchObject({ status: "playable", stricter: ["limited", "out-of-order"] });
    expect(toms.html).toContain('name="machineStatus"');
    expect(toms.html).toContain("Status nicht ändern");
  });
});
