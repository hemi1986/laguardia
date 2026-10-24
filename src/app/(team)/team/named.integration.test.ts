import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { machineLabels } from "@/modules/collection";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { named } from "./named";

/**
 * Naming what read models return by ID (architecture review 2026-10-25): every team page names the team members and
 * machines it shows through `named` – one round, one rule for an account that is gone, and a machine that is not
 * there is a bug, not a blank.
 */
const db = testDatabase();

describe("named", () => {
  it("names team members and machines in one round, each ID once", async () => {
    const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
    await anExistingTeamMember(db, tom, "Tom");
    const machineId = await aRegisteredMachine(db);

    const shown = await named(db, {
      teamMembers: [tom.teamMemberId, undefined, tom.teamMemberId],
      machines: [machineId, machineId],
    });

    expect(shown.name(tom.teamMemberId)).toBe("Tom");
    expect(shown.label(machineId)).toEqual((await machineLabels(db, [machineId])).get(machineId));
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
