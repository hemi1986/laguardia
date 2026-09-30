import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { createMachineModel, type CreateMachineModelInput } from "./create-machine-model";

/**
 * CMD-CreateMachineModel – the decision. The required details and the technology that has to fit the machine
 * category are rules with many cases, so they are tested here (seam catalog); everything else at the command.
 */
const technician = { kind: "team-member", teamMemberId: "tm-1", role: "technician" } as const;
const context = { actor: technician, clock: fixedClock("2026-09-30T10:00:00Z"), newId: () => "model-1" };

const medievalMadness: CreateMachineModelInput = {
  title: "Medieval Madness",
  manufacturer: "Williams",
  year: 1997,
  machineCategory: "pinball",
  technology: "dmd",
};

describe("CMD-CreateMachineModel – the decision", () => {
  it("ST-006: Required details are missing", () => {
    const decision = createMachineModel(undefined, { ...medievalMadness, manufacturer: "   " }, context);

    expect(decision).toEqual({ ok: false, error: "manufacturer-required" });
  });

  it("rejects a machine model without a title or without a machine category", () => {
    const without = (input: Partial<CreateMachineModelInput>) =>
      createMachineModel(undefined, { ...medievalMadness, ...input }, context);

    expect(without({ title: " " })).toEqual({ ok: false, error: "title-required" });
    expect(without({ machineCategory: undefined })).toEqual({ ok: false, error: "machine-category-required" });
  });
});
