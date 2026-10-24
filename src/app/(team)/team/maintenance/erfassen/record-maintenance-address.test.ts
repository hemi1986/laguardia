import { describe, expect, it } from "vitest";
import { backAddress, recordedAddress, recordMaintenanceReturnOf } from "./record-maintenance-address";

describe("where the form „Wartung erfassen“ leads back to (ST-047)", () => {
  it.each([
    ["geraet", "machine"],
    ["machine", "list"],
    [undefined, "list"],
    ["", "list"],
    ["https://evil.example/", "list"],
    ["/team/machines/LG-042", "list"],
    [["geraet", "geraet"], "list"],
  ] as const)("%j is the %s – a fixed choice, never an address", (value, expected) => {
    expect(recordMaintenanceReturnOf(value)).toBe(expected);
  });

  it("leads to the machine record or the list at the task", () => {
    const ids = { maintenanceTaskId: "task-1", museumNumber: "LG 042/x" };
    expect(backAddress("machine", ids)).toBe("/team/machines/LG%20042%2Fx");
    expect(backAddress("list", ids)).toBe("/team/maintenance?task=task-1");
  });

  it("lands on the machine record only when its museum number is known", () => {
    const ids = { maintenanceRecordId: "record-1", maintenanceTaskId: "task-1" };
    expect(recordedAddress({ ...ids, museumNumber: "LG-042" })).toBe(
      "/team/machines/LG-042?maintenanceRecorded=record-1",
    );
    expect(recordedAddress(ids)).toBe("/team/maintenance?task=task-1&recorded=record-1");
  });
});
