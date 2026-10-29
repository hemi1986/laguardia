import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { machineLabels } from "@/modules/collection";
import { recordMaintenanceCommand } from "@/modules/maintenance";
import { logWorkCommand } from "@/modules/repair";
import { editAccount, teamMemberAccounts } from "@/modules/team";
import { aTeamMemberAccount } from "@/modules/team/accounts.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { memoryStorage } from "@/platform/storage";
import { anOpenDefectIn } from "@/test-support/defects";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { aMaintenanceTaskIn } from "@/test-support/maintenance";
import { loadDefectDetails } from "../defects/[defectId]/defect-details-data";
import { DefectDetailsView } from "../defects/[defectId]/defect-details";
import { loadMachineRecord } from "../machines/[museumNumber]/machine-record-data";
import { MachineRecordView } from "../machines/[museumNumber]/machine-record";
import { TeamMembersList } from "./team-members-list";

/**
 * A team member's name belongs to the team member, not to a copy on what they did (ST-088): everything refers to them
 * by ID, so a rename shows on the defect's page, the machine record and the team members list. In a database of its
 * own – the scenario changes the one maintenance plan.
 */
const isolated = isolatedTestDatabase("renamed_team_member");
let db: NodePgDatabase;

beforeAll(async () => {
  db = await isolated.reset();
});

afterAll(() => isolated.close());

const NOW = "2026-10-20T10:00:00Z";

async function anAccount(name: string, role: "helper" | "technician") {
  const username = `${name.split(" ")[0].toLowerCase()}_${randomUUID().slice(0, 8)}`;
  const { id } = await aTeamMemberAccount(db, { name, username, role, password: "secret-password-10" });
  return { actor: { kind: "team-member", teamMemberId: id, role } as const, username };
}

async function done(outcome: Promise<{ ok: true } | { ok: false; error: string }>) {
  const result = await outcome;
  if (!result.ok) throw new Error(result.error);
}

/** What the three pages show, as Tom sees them. */
async function shown(tom: { teamMemberId: string; role: "technician" }, defectId: string, museumNumber: string) {
  const clock = fixedClock(NOW);
  const viewer = { id: tom.teamMemberId, role: tom.role };
  const details = await loadDefectDetails(db, clock, defectId, { storage: memoryStorage(), viewer });
  const record = await loadMachineRecord(db, museumNumber, { clock, viewer });
  const accounts = await teamMemberAccounts(db);
  return {
    defectPage: renderToStaticMarkup(createElement(DefectDetailsView, { details })),
    machineRecord: renderToStaticMarkup(createElement(MachineRecordView, { record, museumNumber })),
    list: renderToStaticMarkup(createElement(TeamMembersList, { accounts, deactivatedShown: false })),
  };
}

describe("a renamed team member", () => {
  it("ST-088: A renamed team member's name shows on everything they did", async () => {
    const { actor: tom } = await anAccount("Tom Keller", "technician");
    const { actor: anna, username } = await anAccount("Anna Berger", "helper");
    const { machineId, defectId } = await anOpenDefectIn(db, {
      recordedBy: tom,
      at: fixedClock("2026-10-15T09:00:00Z"),
      title: "Left flipper weak",
      suitableForHelpers: true,
    });
    const museumNumber = (await machineLabels(db, [machineId])).get(machineId)!.museumNumber;
    await done(
      executeCommand(
        logWorkCommand,
        { defectId, version: 0, whatWasDone: "Cleaned the flipper mechanism", partsUsed: "" },
        { actor: anna, db, clock: fixedClock("2026-10-16T09:00:00Z"), newId: randomUUID },
      ),
    );
    const taskId = await aMaintenanceTaskIn(db, {
      name: "Wax playfield",
      machineIds: [machineId],
      suitableForHelpers: true,
      at: "2026-10-01T09:00:00Z",
      by: tom,
    });
    await done(
      executeCommand(
        recordMaintenanceCommand,
        { maintenanceTaskId: taskId, machineId, outcome: "done", date: undefined, note: "" },
        { actor: anna, db, clock: fixedClock("2026-10-17T09:00:00Z"), newId: randomUUID },
      ),
    );
    const before = await shown(tom, defectId, museumNumber);
    expect(before.defectPage).toContain("Anna Berger");
    expect(before.machineRecord).toContain("Anna Berger");

    const renamed = await editAccount(
      { teamMemberId: anna.teamMemberId, name: "Anna Schmidt", username, role: "helper", newPassword: "" },
      { db, actor: tom },
    );
    expect(renamed.ok).toBe(true);

    const after = await shown(tom, defectId, museumNumber);
    expect(after.defectPage).toMatch(/Cleaned the flipper mechanism/);
    expect(after.defectPage).toContain("Anna Schmidt");
    expect(after.machineRecord).toContain("Anna Schmidt");
    expect(after.list).toContain("Anna Schmidt");
    for (const page of Object.values(after)) expect(page).not.toContain("Anna Berger");
  });
});
