import { describe, expect, it } from "vitest";
import {
  aDefect,
  aFile,
  aHelper,
  aMachine,
  aMachineModel,
  aMaintenancePlan,
  aMaintenanceRecord,
  aMaintenanceTask,
  aProblemReport,
  aTechnician,
  BUILDER_TIME,
} from "./builders";

describe("test-data builders", () => {
  it("build a machine model with the required attributes and the given overrides", () => {
    const model = aMachineModel({ title: "Eight Ball Deluxe", machineCategory: "pinball", technology: "solid-state" });

    expect(model).toMatchObject({ title: "Eight Ball Deluxe", machineCategory: "pinball", technology: "solid-state" });
    expect(model.manufacturer).not.toBe("");
  });

  it("build machines with distinct IDs and distinct museum numbers in the LG-000 format", () => {
    const first = aMachine();
    const second = aMachine();

    expect(first.id).not.toBe(second.id);
    expect(first.museumNumber).not.toBe(second.museumNumber);
    expect(first.museumNumber).toMatch(/^LG-\d{3}$/);
    expect(first).toMatchObject({ machineStatus: "playable", registeredAt: new Date("2026-09-27T10:00:00Z") });
  });

  it("attach a file to exactly one machine or machine model", () => {
    const model = aMachineModel();

    expect(aFile().attachedTo.kind).toBe("machine");
    expect(aFile({ attachedTo: { kind: "machine-model", machineModelId: model.id } }).attachedTo).toEqual({
      kind: "machine-model",
      machineModelId: model.id,
    });
  });

  it("build an untriaged problem report from a visitor for a given machine", () => {
    const machine = aMachine();

    const report = aProblemReport({ machineId: machine.id });

    expect(report).toMatchObject({ machineId: machine.id, reporter: { kind: "visitor" } });
    expect(report.triage).toBeUndefined();
  });

  it("build an open, unclaimed defect with normal priority that a claim can be added to", () => {
    const eva = aHelper({ name: "Eva" });

    const defect = aDefect();

    expect(defect).toMatchObject({ priority: "normal", state: "open", workLog: [] });
    expect(defect.claim).toBeUndefined();
    expect(aDefect({ claim: { claimedBy: eva.id, claimedAt: new Date("2026-09-01T08:00:00Z") } }).claim).toEqual({
      claimedBy: eva.id,
      claimedAt: new Date("2026-09-01T08:00:00Z"),
    });
  });

  it("build a maintenance plan whose tasks keep their restriction and interval in months", () => {
    const task = aMaintenanceTask({ intervalMonths: 3, restriction: { machineCategory: "pinball", technology: "em" } });

    expect(aMaintenancePlan({ tasks: [task] }).tasks).toEqual([task]);
    expect(task).toMatchObject({ intervalMonths: 3, restriction: { machineCategory: "pinball", technology: "em" } });
  });

  it("build a maintenance record for a machine and maintenance task, done by default", () => {
    const record = aMaintenanceRecord();

    expect(record).toMatchObject({ outcome: "done", recordedAt: BUILDER_TIME });
    expect(record.machineId).not.toBe(record.maintenanceTaskId);
  });

  it("build team members with each role", () => {
    expect(aHelper()).toMatchObject({ role: "helper" });
    expect(aTechnician()).toMatchObject({ role: "technician" });
    expect(aHelper().id).not.toBe(aHelper().id);
  });
});
