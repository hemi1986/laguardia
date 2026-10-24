import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { executeCommand } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { named } from "./named";

/**
 * Naming what read models return by ID (architecture review 2026-10-25): every team page names the team members and
 * machines it shows through `named` – one round, one rule for an account that is gone, and a machine that is not
 * there is a bug, not a blank.
 */
const db = testDatabase();

describe("named", () => {
  it("names the team members and machines of all the parts of a page in one call", async () => {
    const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
    const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
    await anExistingTeamMember(db, tom, "Tom");
    await anExistingTeamMember(db, eva, "Eva");
    const title = `Medieval Madness ${randomUUID().slice(0, 8)}`;
    const model = await executeCommand(
      createMachineModelCommand,
      { title, manufacturer: "Williams", machineCategory: "pinball" },
      { actor: tom, db, newId: randomUUID },
    );
    if (!model.ok) throw new Error(model.error);
    const machine = await executeCommand(
      registerMachineCommand,
      {
        machineModelId: model.result.machineModelId,
        museumNumber: undefined,
        serialNumber: undefined,
        location: "Hall 2",
        machineStatus: "playable",
      },
      { actor: tom, db, newId: randomUUID },
    );
    if (!machine.ok) throw new Error(machine.error);
    // The museum number is assigned by the command – the one it says it gave.
    const { machineId, museumNumber } = machine.result;

    const shown = await named(
      db,
      { teamMembers: [tom.teamMemberId, undefined], machines: [machineId] },
      { teamMembers: [eva.teamMemberId, tom.teamMemberId], machines: [machineId, null] },
    );

    expect(shown.name(tom.teamMemberId)).toBe("Tom");
    expect(shown.name(eva.teamMemberId)).toBe("Eva");
    expect(shown.label(machineId)).toEqual({ museumNumber, machineModelTitle: title });
  });

  it("says „unbekannt“ for an account that is not there", async () => {
    const shown = await named(db, { teamMembers: [] });

    expect(shown.name(randomUUID())).toBe("unbekannt");
  });

  it("refuses to name a machine that is not there – a read model only returns registered machines", async () => {
    const unknown = randomUUID();
    const shown = await named(db, { machines: [unknown] });

    expect(() => shown.label(unknown)).toThrow(unknown);
  });
});
