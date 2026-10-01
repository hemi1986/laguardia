import { randomUUID } from "node:crypto";
import type { MachineCategory, MachineModel, Technology } from "@/modules/collection";
import type { Role } from "@/platform/command";

/**
 * Test-data builders for every aggregate of docs/architecture/data-model.md and for team members of each role.
 * Each builder returns a valid record with neutral defaults; a test overrides only what it is about.
 *
 * The types are local plain records as long as an aggregate has no code yet. The story that introduces an
 * aggregate's real domain type switches its builder to that type.
 */

/** Default time of every "… at" – a fixed point, never the real clock. */
export const BUILDER_TIME = new Date("2026-09-27T10:00:00Z");

const at = () => new Date(BUILDER_TIME);

let museumNumbers = 0;

export type MachineStatus = "playable" | "limited" | "out-of-order" | "not-on-display";

/** AGG-MachineModel has its real domain type since ST-006 – the builder uses it, not a local record. */
export type { MachineCategory, MachineModel, Technology };

export type TeamMember = { id: string; name: string; role: Role; lastSeen?: Date };

export function aTeamMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return { id: randomUUID(), name: "Tom", role: "helper", ...overrides };
}

export const aHelper = (overrides: Partial<TeamMember> = {}) => aTeamMember({ ...overrides, role: "helper" });

export const aTechnician = (overrides: Partial<TeamMember> = {}) =>
  aTeamMember({ name: "Eva", ...overrides, role: "technician" });

/** AGG-MachineModel */
export function aMachineModel(overrides: Partial<MachineModel> = {}): MachineModel {
  return {
    id: randomUUID(),
    title: "Fireball",
    manufacturer: "Bally",
    year: 1972,
    machineCategory: "pinball",
    technology: "em",
    ...overrides,
  };
}

/** AGG-Machine */
export type Machine = {
  id: string;
  museumNumber: string;
  machineModelId: string;
  serialNumber?: string;
  location: string;
  machineStatus: MachineStatus;
  registeredAt: Date;
  statusChanges: {
    previousStatus: MachineStatus;
    newStatus: MachineStatus;
    reason: string;
    changedBy: string;
    changedAt: Date;
  }[];
  retirement?: { reason: string; retiredBy: string; retiredAt: Date };
};

export function aMachine(overrides: Partial<Machine> = {}): Machine {
  museumNumbers += 1;
  if (museumNumbers > 999) throw new Error("aMachine: museum numbers LG-001…LG-999 used up – pass museumNumber");
  return {
    id: randomUUID(),
    museumNumber: `LG-${String(museumNumbers).padStart(3, "0")}`,
    machineModelId: randomUUID(),
    location: "Hall 1, row 1",
    machineStatus: "playable",
    registeredAt: at(),
    statusChanges: [],
    ...overrides,
  };
}

/** AGG-File – attached to exactly one machine or one machine model. */
export type File = {
  id: string;
  attachedTo: { kind: "machine"; machineId: string } | { kind: "machine-model"; machineModelId: string };
  title: string;
  fileCategory: "manual" | "schematic" | "photo" | "other";
  content?: { contentReference: string; originalName: string; mediaType: string; size: number };
  attachedBy: string;
  attachedAt: Date;
  removedBy?: string;
  removedAt?: Date;
};

export function aFile(overrides: Partial<File> = {}): File {
  return {
    id: randomUUID(),
    attachedTo: { kind: "machine", machineId: randomUUID() },
    title: "Manual",
    fileCategory: "manual",
    content: {
      contentReference: "files/manual.pdf",
      originalName: "manual.pdf",
      mediaType: "application/pdf",
      size: 1024,
    },
    attachedBy: randomUUID(),
    attachedAt: at(),
    ...overrides,
  };
}

export type Photo = { contentReference: string; mediaType: string; size: number };

/** AGG-ProblemReport – untriaged by default. */
export type ProblemReport = {
  id: string;
  machineId: string;
  description?: string;
  photo?: Photo;
  reporter: { kind: "visitor" } | { kind: "team-member"; teamMemberId: string };
  reportedAt: Date;
  triage?: {
    outcome: "defect-recorded" | "linked" | "resolved-on-the-spot" | "dismissed";
    triagedBy: string;
    triagedAt: Date;
    defectId?: string;
    note?: string;
    dismissalReason?: string;
  };
};

export function aProblemReport(overrides: Partial<ProblemReport> = {}): ProblemReport {
  return {
    id: randomUUID(),
    machineId: randomUUID(),
    description: "Left flipper is weak",
    reporter: { kind: "visitor" },
    reportedAt: at(),
    ...overrides,
  };
}

/** AGG-Defect – open, unclaimed, not on hold and with normal priority by default. */
export type Defect = {
  id: string;
  machineId: string;
  originatingProblemReportId: string;
  title: string;
  priority: "high" | "normal" | "low";
  suitableForHelpers: boolean;
  recordedBy: string;
  recordedAt: Date;
  state: "open" | "resolved" | "closed-on-retirement";
  closedOnRetirementAt?: Date;
  claim?: { claimedBy: string; assignedBy?: string; claimedAt: Date };
  hold?: { reason: "waiting-for-part" | "waiting-for-technician" | "other"; note?: string; onHoldSince: Date };
  workLog: {
    id: string;
    whatWasDone: string;
    partsUsed?: string;
    photos: Photo[];
    loggedBy: string;
    loggedAt: Date;
  }[];
  resolutions: {
    closingNote: string;
    resolvedBy: string;
    resolvedAt: Date;
    reopenReason?: string;
    reopenedBy?: string;
    reopenedAt?: Date;
  }[];
};

export function aDefect(overrides: Partial<Defect> = {}): Defect {
  return {
    id: randomUUID(),
    machineId: randomUUID(),
    originatingProblemReportId: randomUUID(),
    title: "Left flipper weak",
    priority: "normal",
    suitableForHelpers: false,
    recordedBy: randomUUID(),
    recordedAt: at(),
    state: "open",
    workLog: [],
    resolutions: [],
    ...overrides,
  };
}

/** A maintenance task of AGG-MaintenancePlan; all initial intervals are whole months. */
export type MaintenanceTask = {
  id: string;
  name: string;
  instruction: string;
  intervalMonths: number;
  suitableForHelpers: boolean;
  restriction?: { machineCategory?: MachineCategory; technology?: Technology };
  startDate: string;
  removedAt?: Date;
};

export function aMaintenanceTask(overrides: Partial<MaintenanceTask> = {}): MaintenanceTask {
  return {
    id: randomUUID(),
    name: "Clean the playfield",
    instruction: "Clean and wax the playfield.",
    intervalMonths: 1,
    suitableForHelpers: true,
    startDate: "2026-09-01",
    ...overrides,
  };
}

/** AGG-MaintenancePlan – the singleton, one per museum. */
export type MaintenancePlan = { tasks: MaintenanceTask[] };

export function aMaintenancePlan(overrides: Partial<MaintenancePlan> = {}): MaintenancePlan {
  return { tasks: [aMaintenanceTask()], ...overrides };
}

/** AGG-MaintenanceRecord */
export type MaintenanceRecord = {
  id: string;
  machineId: string;
  maintenanceTaskId: string;
  outcome: "done" | "partially-done";
  note?: string;
  recordedBy: string;
  recordedAt: Date;
};

export function aMaintenanceRecord(overrides: Partial<MaintenanceRecord> = {}): MaintenanceRecord {
  return {
    id: randomUUID(),
    machineId: randomUUID(),
    maintenanceTaskId: randomUUID(),
    outcome: "done",
    recordedBy: randomUUID(),
    recordedAt: at(),
    ...overrides,
  };
}
