import { describe, expect, it } from "vitest";
import { groupMachines } from "./machine-groups";

describe("grouping machines for a choice (G27)", () => {
  const m = (museumNumber: string, machineCategory: "pinball" | "arcade" | "other", technology?: "em" | "dmd" | "lcd" | "crt" | "solid-state") => ({
    museumNumber,
    machineCategory,
    technology,
  });

  it("orders the groups as CONTEXT.md does and the machines of a group by museum number", () => {
    const groups = groupMachines([
      m("LG-010", "other"),
      m("LG-042", "pinball", "dmd"),
      m("LG-003", "arcade"),
      m("LG-007", "pinball"),
      m("LG-020", "arcade", "crt"),
      m("LG-005", "pinball", "em"),
      m("LG-009", "pinball", "em"),
      m("LG-100", "pinball", "em"),
      m("LG-013", "pinball", "lcd"),
      m("LG-004", "arcade", "lcd"),
      m("LG-006", "pinball", "solid-state"),
    ]);

    expect(groups.map((group) => [group.machineCategory, group.technology])).toEqual([
      ["pinball", "em"],
      ["pinball", "solid-state"],
      ["pinball", "dmd"],
      ["pinball", "lcd"],
      ["pinball", undefined],
      ["arcade", "crt"],
      ["arcade", "lcd"],
      ["arcade", undefined],
      ["other", undefined],
    ]);
    expect(groups[0].machines.map((machine) => machine.museumNumber)).toEqual(["LG-005", "LG-009", "LG-100"]);
  });

  it("shows no group without a machine", () => {
    expect(groupMachines([m("LG-005", "pinball", "em")])).toHaveLength(1);
    expect(groupMachines([])).toEqual([]);
  });
});
