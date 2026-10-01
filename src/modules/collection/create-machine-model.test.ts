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
  year: "1997",
  machineCategory: "pinball",
  technology: "dmd",
};

describe("CMD-CreateMachineModel – the decision", () => {
  it("ST-006: Required details are missing", () => {
    const decision = createMachineModel(undefined, { ...medievalMadness, manufacturer: "   " }, context);

    expect(decision).toEqual({ ok: false, error: "manufacturer-required" });
  });

  it.each([
    { category: "arcade", technology: "dmd" },
    { category: "pinball", technology: "crt" },
    { category: "other", technology: "lcd" },
  ] as const)("ST-006: Technology must fit the machine category", ({ category, technology }) => {
    const decision = createMachineModel(
      undefined,
      { ...medievalMadness, machineCategory: category, technology },
      context,
    );

    expect(decision).toEqual({ ok: false, error: "technology-does-not-fit-machine-category" });
  });

  it("accepts every technology that fits its machine category, and none for Other", () => {
    const fitting = [
      { machineCategory: "pinball", technology: "em" },
      { machineCategory: "pinball", technology: "solid-state" },
      { machineCategory: "pinball", technology: "dmd" },
      { machineCategory: "pinball", technology: "lcd" },
      { machineCategory: "arcade", technology: "crt" },
      { machineCategory: "arcade", technology: "lcd" },
      { machineCategory: "other", technology: undefined },
    ] as const;

    for (const combination of fitting) {
      const decision = createMachineModel(undefined, { ...medievalMadness, ...combination }, context);
      expect(decision.ok, `${combination.machineCategory} / ${combination.technology}`).toBe(true);
    }
  });

  it("ST-006: Year must be a four-digit year", () => {
    const decision = createMachineModel(undefined, { ...medievalMadness, year: "ca. 1997" }, context);

    expect(decision).toEqual({ ok: false, error: "year-must-be-four-digits" });
  });

  it("takes a four-digit year as a number and no year at all when the field was empty", () => {
    const withYear = (year: string | undefined) =>
      createMachineModel(undefined, { ...medievalMadness, year }, context);

    expect(withYear(" 1997 ").ok && withYear(" 1997 ")).toMatchObject({ state: { year: 1997 } });
    expect(withYear("").ok && withYear("")).toMatchObject({ state: { year: undefined } });
    expect(withYear(undefined).ok && withYear(undefined)).toMatchObject({ state: { year: undefined } });
    for (const year of ["99999999999", "19977", "997", "-1997", "1997er"]) {
      expect(withYear(year), year).toEqual({ ok: false, error: "year-must-be-four-digits" });
    }
  });

  it("rejects a machine model without a title or without a machine category", () => {
    const without = (input: Partial<CreateMachineModelInput>) =>
      createMachineModel(undefined, { ...medievalMadness, ...input }, context);

    expect(without({ title: " " })).toEqual({ ok: false, error: "title-required" });
    expect(without({ machineCategory: undefined })).toEqual({ ok: false, error: "machine-category-required" });
  });
});
