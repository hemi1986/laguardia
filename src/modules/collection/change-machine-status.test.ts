import { describe, expect, it } from "vitest";
import { machineStatusesToChangeTo } from "./change-machine-status";

/**
 * Which machine statuses a team member can change a machine to (ST-012) – what the machine record and the status
 * change page offer; CMD-ChangeMachineStatus refuses everything else anyway.
 */
describe("the machine statuses a team member can change a machine to", () => {
  it.each([
    ["technician", "playable", false, ["limited", "out-of-order", "not-on-display"]],
    ["technician", "out-of-order", false, ["playable", "limited", "not-on-display"]],
    ["helper", "playable", false, ["out-of-order"]],
    ["helper", "not-on-display", false, ["out-of-order"]],
    // A helper has nothing to change on a machine that is already Out of order (user, 2026-10-03).
    ["helper", "out-of-order", false, []],
    // A retired machine is final.
    ["technician", "limited", true, []],
    ["helper", "playable", true, []],
  ] as const)("a %s, a %s machine, retired: %s → %j", (role, machineStatus, retired, expected) => {
    expect(machineStatusesToChangeTo(role, { machineStatus, retired })).toEqual(expected);
  });
});
