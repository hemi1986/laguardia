import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { registerMachine, type RegisterMachineInput } from "./register-machine";

/**
 * The museum number rule of CMD-RegisterMachine at its decision (seam catalog: a rule with many cases). The
 * scenarios run at the command seam; here only the case no database run can reach cheaply – every number given out.
 */
const technician = { kind: "team-member", teamMemberId: "eva", role: "technician" } as const;
const context = { actor: technician, clock: fixedClock("2026-10-02T10:00:00Z"), newId: () => "new-machine" };
const input: RegisterMachineInput = {
  machineModelId: "medieval-madness",
  museumNumber: undefined,
  serialNumber: undefined,
  location: "Hall 2, row 3",
  machineStatus: "playable",
};

function allGivenOutExcept(...free: number[]): string[] {
  return Array.from({ length: 999 }, (_, i) => i + 1)
    .filter((number) => !free.includes(number))
    .map((number) => `LG-${String(number).padStart(3, "0")}`);
}

describe("the museum number La Guardia assigns", () => {
  it("is refused when LG-001 to LG-999 are all given out", () => {
    const facts = { museumNumbersGivenOut: allGivenOutExcept(), machineModelExists: true };

    expect(registerMachine(facts, input, context)).toEqual({ ok: false, error: "no-museum-number-free" });
  });

  it("after LG-999 is the highest free one below it, counting down", () => {
    const facts = { museumNumbersGivenOut: allGivenOutExcept(17, 500), machineModelExists: true };

    expect(registerMachine(facts, input, context)).toMatchObject({ ok: true, state: { museumNumber: "LG-500" } });
  });

  it("is the next above the highest, even when a number in another format was stored", () => {
    const facts = { museumNumbersGivenOut: ["LG-041", "LG-42A"], machineModelExists: true };

    expect(registerMachine(facts, input, context)).toMatchObject({ ok: true, state: { museumNumber: "LG-042" } });
  });
});
