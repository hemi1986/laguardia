import {
  aiAssessmentsInRepairHistory,
  aiDependencies,
  filesTheAiCannotRead,
  type AiDependencies,
} from "@/modules/ai-assistance";
import {
  correctDetailsRefusal,
  latestStatusChanges,
  type MachineRecord,
  machineRecord,
  machineStatusesToChangeTo,
  mayRemoveFiles,
  type FileOfMachine,
  type Retirement,
  retireRefusal,
  type StatusChange,
} from "@/modules/collection";
import { machineMaintenance, type MachineMaintenance, type NamedMaintenanceRecord } from "@/modules/maintenance";
import { openDefects, recentRepairHistory, type EndedRepairHistoryEntry } from "@/modules/repair";
import { systemClock, type Clock } from "@/platform/clock";
import type { Database, Latest } from "@/platform/command";
import type { Viewer } from "../../claimant";
import { openDefectReferences, shownOpenDefects, type OpenDefectsItem } from "../../defects/open-defects-data";
import { named } from "../../named";
import { photoViewAddresses } from "@/photo";
import { s3Storage } from "@/platform/storage";
import type { PhotoSource } from "../../team-photos";
import { shownAiAssessmentData, type ShownAiAssessmentData } from "../../ai-assessment-data";

/** A status change as the machine record shows it: who changed it by name, not by ID. */
export type NamedStatusChange = Omit<StatusChange, "changedBy"> & { changedBy: string };

/** The machine record with names – what the page shows (ST-009). */
/** A file of the machine record, marked when the AI cannot read it (RM-MachineRecord, ST-109). */
export type MarkedFile = FileOfMachine & { unreadableForAi: boolean };

export type MachineRecordData = Omit<MachineRecord, "retirement" | "files"> & {
  /** Section 8 (ST-037): its files and its machine model's – „Für die KI nicht lesbar“ where indexing failed (ST-109). */
  files: MarkedFile[];
  /** Section 6 (ST-093): its latest status changes – at most `LATEST_STATUS_CHANGES` –, and how many entries its status history has, the registration included. */
  statusHistory: Latest<NamedStatusChange>;
  retirement?: Omit<Retirement, "retiredBy"> & { retiredBy: string };
  /** Section 4 (ST-033): its open defects, as the open defects list shows them – high priority first. */
  openDefects: OpenDefectsItem[];
  /** Section 7 (ST-033): its most recently ended entries of the repair history – at most `RECENT_REPAIR_HISTORY_ENTRIES` –, and how many entries its whole repair history has, open defects included. */
  repairHistory: Latest<ShownEndedRepairHistoryEntry>;
  /** Section 5 (ST-047): its due maintenance tasks and latest maintenance records – Maintenance's. */
  maintenance: ShownMachineMaintenance;
  /** The machine record's own actions the viewer may take (G11) – a section another module decides per item brings its own offer. */
  actions: MachineRecordActions;
};

/**
 * The actions of the machine record the viewer may take (G11), decided once with the record (architecture review
 * 2026-10-18) – the page and its sections only show them. The commands check again.
 */
export type MachineRecordActions = {
  /** Section 2 (ST-015): every team member, not for a retired machine. */
  reportProblem: boolean;
  /** Section 3 (ST-034): every team member, not for a retired machine. */
  changeLocation: boolean;
  /** Section 3 (ST-012): only where the viewer has a machine status to set – none for a retired machine. */
  changeStatus: boolean;
  /** Section 3 (ST-035): technicians only, not for a retired machine – Collection's own rule. */
  correctDetails: boolean;
  /** Section 8 (ST-037): every team member, a retired machine's record too. */
  attachFile: boolean;
  /** Section 8 (ST-038): technicians only, a retired machine's record too – Collection's own rule. */
  removeFile: boolean;
  /** Section 9 (ST-039): technicians only, not for a retired machine – Collection's own rule. */
  retire: boolean;
};

/** Section 5 „Wartung“ (ST-047): Maintenance's answer for the machine, with Team's names. */
export type ShownMachineMaintenance = Omit<MachineMaintenance, "records"> & {
  records: Latest<ShownMaintenanceRecord>;
};

/** A maintenance record as the machine record shows it – who recorded it by name. */
export type ShownMaintenanceRecord = Omit<NamedMaintenanceRecord, "recordedBy"> & { recordedBy: string };

/** How many of the latest status changes the machine record shows (ST-093, G24). */
export const LATEST_STATUS_CHANGES = 5;

/** How many of the latest maintenance records the machine record shows (user, backlog grooming 2026-10-17). */
export const LATEST_MAINTENANCE_RECORDS = 5;

/** How many of the most recently ended entries of the repair history the machine record shows (user, 2026-10-14, `/implement ST-033`). */
export const RECENT_REPAIR_HISTORY_ENTRIES = 3;

/** An entry of the repair history that has ended, as section 7 shows it – who ended it by name. */
export type ShownEndedRepairHistoryEntry = Omit<EndedRepairHistoryEntry, "resolvedBy"> & {
  resolvedBy: string;
  /** A defect's written and failed AI assessments, the newest first – each folded (ST-111); none for a problem. */
  aiAssessments: ShownAiAssessmentData[];
};

/**
 * The page's data: the Collection module's machine record, with the team members' names from the Team module, and the
 * Repair module's open defects and repair history (ST-033). The first read across two modules (ST-009): neither module
 * imports the other – the page composes their public queries. `clock` makes "open for … days" (ST-021); `viewer` is the
 * team member looking at the page – one's own claim is said as such (ST-025), and what they may do here is decided by
 * their role (`actions`).
 */
export async function loadMachineRecord(
  db: Database,
  museumNumber: string,
  {
    clock = systemClock,
    viewer,
    ai = aiDependencies(),
    storage = s3Storage(),
  }: PhotoSource & { clock?: Clock; viewer: Viewer; ai?: AiDependencies },
): Promise<MachineRecordData | undefined> {
  const record = await machineRecord(db, museumNumber);
  if (!record) return undefined;
  const [statusHistory, open, recent, maintenance, unreadable] = await Promise.all([
    latestStatusChanges(db, record.id, LATEST_STATUS_CHANGES),
    openDefects(db, { machineId: record.id }),
    recentRepairHistory(db, record.id, RECENT_REPAIR_HISTORY_ENTRIES),
    machineMaintenance(db, clock, record.id, { teamMember: viewer, latestRecordCount: LATEST_MAINTENANCE_RECORDS }),
    // AI assistance's mark – none while AI is off (user, 2026-10-31); the page composes (ST-009).
    filesTheAiCannotRead(
      db,
      ai,
      record.files.map((file) => file.id),
    ),
  ]);
  // AI assistance's AI assessments of the latest repairs' defects (ST-111) – the page composes (ST-009).
  const aiAssessments = await aiAssessmentsInRepairHistory(
    db,
    recent.latest.flatMap((entry) => (entry.kind === "defect" ? [entry.id] : [])),
    ai,
  );
  const assessments = [...aiAssessments.values()].flat();
  const [shown, photos] = await Promise.all([
    named(db, openDefectReferences(open), {
      teamMembers: [
        ...statusHistory.latest.map((change) => change.changedBy),
        record.retirement?.retiredBy,
        ...recent.latest.map((entry) => entry.resolvedBy),
        ...maintenance.records.latest.map((maintenanceRecord) => maintenanceRecord.recordedBy),
        ...assessments.map((assessment) => assessment.requestedBy),
      ],
    }),
    photoViewAddresses(
      storage,
      clock,
      assessments.flatMap((assessment) => assessment.photos),
    ),
  ]);
  return {
    ...record,
    files: record.files.map((file) => ({ ...file, unreadableForAi: unreadable.has(file.id) })),
    statusHistory: {
      ...statusHistory,
      latest: statusHistory.latest.map((change) => ({ ...change, changedBy: shown.name(change.changedBy) })),
    },
    retirement: record.retirement && { ...record.retirement, retiredBy: shown.name(record.retirement.retiredBy) },
    openDefects: shownOpenDefects(clock, open, shown, viewer),
    repairHistory: {
      ...recent,
      latest: recent.latest.map((entry) => ({
        ...entry,
        resolvedBy: shown.name(entry.resolvedBy),
        aiAssessments: (entry.kind === "defect" ? (aiAssessments.get(entry.id) ?? []) : []).map((assessment) =>
          shownAiAssessmentData(assessment, shown, photos),
        ),
      })),
    },
    maintenance: {
      ...maintenance,
      records: {
        ...maintenance.records,
        latest: maintenance.records.latest.map((maintenanceRecord) => ({
          ...maintenanceRecord,
          recordedBy: shown.name(maintenanceRecord.recordedBy),
        })),
      },
    },
    actions: actionsOf(record, viewer),
  };
}

function actionsOf(record: MachineRecord, viewer: Viewer): MachineRecordActions {
  const active = record.retirement === undefined;
  return {
    reportProblem: active,
    changeLocation: active,
    changeStatus:
      machineStatusesToChangeTo(viewer.role, { machineStatus: record.machineStatus, retired: !active }).length > 0,
    correctDetails: correctDetailsRefusal({ retired: !active }, viewer) === undefined,
    attachFile: true,
    removeFile: mayRemoveFiles(viewer),
    retire: retireRefusal({ retired: !active }, viewer) === undefined,
  };
}
