import { and, asc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { aggregateStore, isId, history, type AggregateStore, type Database } from "@/platform/command";
import type { MachineCategory, Technology } from "./create-machine-model";
import { filesOfMachine, type FileOfMachine } from "./files";
import { categoryHistory } from "./machine-models";
import {
  machineStatuses,
  type Machine,
  type MachineStatus,
  type RegistrationFacts,
  type Retirement,
  type StatusChange,
} from "./register-machine";
import { machine, machineModel, machineStatusChange, museumNumber } from "./schema";

/** The status history of a machine – append-only (Q13): only the entries not stored yet are inserted. */
const statusHistory = history({
  table: machineStatusChange,
  owner: "machineId",
  toEntry: (row): StatusChange => ({
    id: row.id,
    previousStatus: row.previousStatus ?? undefined,
    newStatus: row.newStatus,
    reason: row.reason,
    changedBy: row.changedBy,
    changedAt: row.changedAt,
  }),
  toRow: (change) => ({
    id: change.id,
    previousStatus: change.previousStatus ?? null,
    newStatus: change.newStatus,
    reason: change.reason,
    changedBy: change.changedBy,
    changedAt: change.changedAt,
  }),
});

const machineRows = aggregateStore({
  type: "AGG-Machine",
  table: machine,
  histories: { statusHistory },
  toState: (row, histories): Machine => ({
    id: row.id,
    museumNumber: row.museumNumber,
    machineModelId: row.machineModelId,
    serialNumber: row.serialNumber ?? undefined,
    location: row.location,
    machineStatus: row.machineStatus,
    registeredAt: row.registeredAt,
    statusHistory: histories.statusHistory,
    retirement: retirementOf(row),
  }),
  toRow: (state: Machine) => ({
    id: state.id,
    museumNumber: state.museumNumber,
    machineModelId: state.machineModelId,
    serialNumber: state.serialNumber ?? null,
    location: state.location,
    machineStatus: state.machineStatus,
    registeredAt: state.registeredAt,
    retirementReason: state.retirement?.reason ?? null,
    retiredBy: state.retirement?.retiredBy ?? null,
    retiredAt: state.retirement?.retiredAt ?? null,
  }),
});

/**
 * How AGG-Machine is stored (ST-007): the machine row (versioned, HS-16) with its status history, and its museum
 * number in the set of all museum numbers ever given out. A museum number row is never deleted – a corrected-away
 * number (ST-035) stays there as reserved, a retired machine keeps its own.
 */
export const machines: AggregateStore<Machine> = {
  ...machineRows,
  async insert(tx, state) {
    await machineRows.insert(tx, state);
    await giveOut(tx, state);
  },
  async update(tx, state, expectedVersion) {
    if (!(await machineRows.update(tx, state, expectedVersion))) return false;
    await giveOut(tx, state);
    return true;
  },
};

/**
 * The machine's current museum number joins the set of all given out; an earlier one of it stays there (reserved).
 * A number given out to another machine fails loudly – the facts' lock and the decision make that unreachable.
 */
async function giveOut(tx: Database, state: Machine): Promise<void> {
  const [owner] = await tx
    .select({ machineId: museumNumber.machineId })
    .from(museumNumber)
    .where(eq(museumNumber.museumNumber, state.museumNumber));
  if (owner?.machineId === state.id) return;
  await tx.insert(museumNumber).values({ museumNumber: state.museumNumber, machineId: state.id });
}

async function statusHistoryOf(db: Database, machineId: string): Promise<StatusChange[]> {
  return (await statusHistory.load(db, [machineId])).get(machineId) ?? [];
}

/**
 * The facts of CMD-RegisterMachine (HS-17). Registrations take one lock first, so they run one after the other:
 * the second of two at the same time sees the museum number the first one got – it takes the next free one, or is
 * told that its own is already used. The museum number's primary key guarantees uniqueness even without the lock.
 */
export async function registrationFacts(tx: Database, input: { machineModelId: string | undefined }) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('museum-number'))`);
  const givenOut = await tx.select({ museumNumber: museumNumber.museumNumber }).from(museumNumber);
  const model =
    input.machineModelId && isId(input.machineModelId)
      ? await tx.select({ id: machineModel.id }).from(machineModel).where(eq(machineModel.id, input.machineModelId))
      : [];
  return {
    museumNumbersGivenOut: givenOut.map((row) => row.museumNumber),
    machineModelExists: model.length > 0,
  } satisfies RegistrationFacts;
}

/** One entry of the machine overview (RM-MachineOverview): what tells a machine apart from its neighbours (G5). */
export type MachineOverviewEntry = {
  id: string;
  museumNumber: string;
  machineModelTitle: string;
  machineCategory: MachineCategory;
  technology?: Technology;
  location: string;
  machineStatus: MachineStatus;
};

/** What the machine overview is narrowed to (ST-008): both are optional and combine. */
export type MachineOverviewQuery = {
  /** Part of a museum number or a machine model title, in any case ("042", "medieval"). */
  search?: string;
  machineStatus?: MachineStatus;
};

/** RM-MachineOverview: the active machines (not retired), sorted by museum number – searched and filtered. */
export async function machineOverview(
  db: Database,
  { search, machineStatus }: MachineOverviewQuery = {},
): Promise<MachineOverviewEntry[]> {
  const term = search?.trim();
  const pattern = term ? `%${term.replace(/[\\%_]/g, (character) => `\\${character}`)}%` : undefined;
  const rows = await db
    .select({
      id: machine.id,
      museumNumber: machine.museumNumber,
      machineModelTitle: machineModel.title,
      machineCategory: machineModel.machineCategory,
      technology: machineModel.technology,
      location: machine.location,
      machineStatus: machine.machineStatus,
    })
    .from(machine)
    .innerJoin(machineModel, eq(machine.machineModelId, machineModel.id))
    .where(
      and(
        isNull(machine.retiredAt),
        machineStatus ? eq(machine.machineStatus, machineStatus) : undefined,
        pattern ? or(ilike(machine.museumNumber, pattern), ilike(machineModel.title, pattern)) : undefined,
      ),
    )
    .orderBy(asc(machine.museumNumber));
  return rows.map((row) => ({ ...row, technology: row.technology ?? undefined }));
}

/**
 * RM-MachineOverview: how many active machines have which machine status – always over all active machines, so it
 * says at any time how many are playable (vision goal 3), whatever the overview is searched or filtered for.
 * Every machine status is there, a zero included: it can still be filtered for (user, 2026-10-02).
 */
export async function machineStatusCounts(db: Database): Promise<Record<MachineStatus, number>> {
  const rows = await db
    .select({ machineStatus: machine.machineStatus, count: sql<number>`count(*)::int` })
    .from(machine)
    .where(isNull(machine.retiredAt))
    .groupBy(machine.machineStatus);
  const counts = Object.fromEntries(machineStatuses.map((status) => [status, 0])) as Record<MachineStatus, number>;
  for (const row of rows) counts[row.machineStatus] = row.count;
  return counts;
}

/** What the visitor machine page (RM-VisitorMachinePage, ST-010) shows of a machine – no ID, nothing internal. */
export type VisitorMachine = {
  machineModelTitle: string;
  manufacturer: string;
  year?: number;
  machineStatus: MachineStatus;
};

/**
 * The machine as visitors see it, by its museum number – active machines only (a retired machine's visitor page is
 * ST-055's). Selects only the visible facts, so nothing else can reach a public page.
 */
export async function visitorMachine(db: Database, museumNumber: string): Promise<VisitorMachine | undefined> {
  const [row] = await db
    .select({
      machineModelTitle: machineModel.title,
      manufacturer: machineModel.manufacturer,
      year: machineModel.year,
      machineStatus: machine.machineStatus,
    })
    .from(machine)
    .innerJoin(machineModel, eq(machine.machineModelId, machineModel.id))
    .where(and(eq(machine.museumNumber, museumNumber), isNull(machine.retiredAt)));
  return row && { ...row, year: row.year ?? undefined };
}

/** The machine record (RM-MachineRecord) as ST-009 builds it – later stories add its further sections (G18). */
export type MachineRecord = {
  id: string;
  museumNumber: string;
  serialNumber?: string;
  machineModel: {
    title: string;
    manufacturer: string;
    year?: number;
    machineCategory: MachineCategory;
    technology?: Technology;
  };
  location: string;
  machineStatus: MachineStatus;
  /** Newest first. "… by" are TeamMemberIds – the page names them through the Team module (ST-009). */
  statusHistory: StatusChange[];
  retirement?: Retirement;
  /** Its files and its machine model's, by file category (ST-037). */
  files: FileOfMachine[];
};

/** RM-MachineRecord: everything about one machine, retired ones included – by its museum number (ST-009). */
export async function machineRecord(db: Database, museumNumber: string): Promise<MachineRecord | undefined> {
  const [row] = await db
    .select({ machine, model: machineModel })
    .from(machine)
    .innerJoin(machineModel, eq(machine.machineModelId, machineModel.id))
    .where(eq(machine.museumNumber, museumNumber));
  if (!row) return undefined;
  const { machine: m, model } = row;
  return {
    id: m.id,
    museumNumber: m.museumNumber,
    serialNumber: m.serialNumber ?? undefined,
    machineModel: {
      title: model.title,
      manufacturer: model.manufacturer,
      year: model.year ?? undefined,
      machineCategory: model.machineCategory,
      technology: model.technology ?? undefined,
    },
    location: m.location,
    machineStatus: m.machineStatus,
    statusHistory: (await statusHistoryOf(db, m.id)).reverse(),
    retirement: retirementOf(m),
    files: await filesOfMachine(db, { machineId: m.id, machineModelId: m.machineModelId }),
  };
}

/** A machine row's retirement – all three columns are set together, or none. */
function retirementOf(row: {
  retirementReason: string | null;
  retiredBy: string | null;
  retiredAt: Date | null;
}): Retirement | undefined {
  return row.retiredAt && row.retiredBy && row.retirementReason
    ? { reason: row.retirementReason, retiredBy: row.retiredBy, retiredAt: row.retiredAt }
    : undefined;
}

/**
 * The machine's retirement lock (ADR 0010): a transaction-scoped advisory lock per machine. CMD-RetireMachine takes it
 * exclusively; the reads other modules' commands check "not retired" with take it shared, so a command in flight
 * finishes before the retirement decides, and one that starts meanwhile waits for its commit and reads it retired.
 * Advisory locks do not conflict with row locks, so changes of the machine row are unaffected.
 */
export async function retirementLock(tx: Database, machineId: string, mode: "exclusive" | "shared"): Promise<void> {
  const key = sql`hashtext(${"machine:" + machineId})`;
  await tx.execute(
    mode === "exclusive" ? sql`SELECT pg_advisory_xact_lock(${key})` : sql`SELECT pg_advisory_xact_lock_shared(${key})`,
  );
}

/**
 * Holds the machine's retirement lock shared until the command commits (ADR 0010) – for a command of another module
 * that changes something on the machine without reading it (CMD-LinkProblemReportToDefect: linking to a resolved
 * defect reopens it from ST-053 on). Call it before any row lock of the command's own.
 */
export function holdAgainstRetirement(tx: Database, machineId: string): Promise<void> {
  return isId(machineId) ? retirementLock(tx, machineId, "shared") : Promise.resolve();
}

/** A machine's status history, oldest first – module-internal, for this module's tests (the record shows it newest first). */
export function machineStatusHistory(db: Database, machineId: string): Promise<StatusChange[]> {
  return statusHistoryOf(db, machineId);
}

/** What a team form on a machine shows of it – the status change (ST-012), the problem report (ST-015), the move (ST-034) – with the version the team member saw (HS-16). */
export type MachineForTeamForm = {
  id: string;
  museumNumber: string;
  machineStatus: MachineStatus;
  location: string;
  version: number;
  retired: boolean;
};

/** The machine a team form acts on, by its museum number – retired ones included, so the page can say so. */
export async function machineForTeamForm(db: Database, museumNumber: string): Promise<MachineForTeamForm | undefined> {
  const [row] = await db
    .select({
      id: machine.id,
      museumNumber: machine.museumNumber,
      machineStatus: machine.machineStatus,
      location: machine.location,
      version: machine.version,
      retiredAt: machine.retiredAt,
    })
    .from(machine)
    .where(eq(machine.museumNumber, museumNumber));
  return (
    row && {
      id: row.id,
      museumNumber: row.museumNumber,
      machineStatus: row.machineStatus,
      location: row.location,
      version: row.version,
      retired: row.retiredAt !== null,
    }
  );
}

/**
 * What the Repair module needs to know about a machine when a problem is reported (context map, Collection → Repair:
 * Repair checks its command rules against the current machine state). Undefined for an unknown machine. In a
 * command it takes the machine's retirement lock shared (ADR 0010): whether it is retired stays true until the command
 * commits. A page, which runs no command, reads it with `{ inCommand: false }` – no lock to wait for.
 */
export async function machineForReporting(
  db: Database,
  machineId: string,
  { inCommand = true }: { inCommand?: boolean } = {},
): Promise<{ machineStatus: MachineStatus; retired: boolean } | undefined> {
  if (!isId(machineId)) return undefined;
  if (inCommand) await retirementLock(db, machineId, "shared");
  const [row] = await db
    .select({ machineStatus: machine.machineStatus, retiredAt: machine.retiredAt })
    .from(machine)
    .where(eq(machine.id, machineId));
  return row && { machineStatus: row.machineStatus, retired: row.retiredAt !== null };
}

/**
 * The ID of an active machine by its museum number – for the server to compose other modules' data (the visitor
 * machine page's count) or to run their commands (a visitor's problem report, ST-013) without the ID reaching a
 * public page. Undefined for an unknown or retired museum number – unless a team page asks for retired ones too (the
 * repair history of a retired machine stays readable, ST-039).
 */
export async function machineIdOf(
  db: Database,
  museumNumber: string,
  { retiredToo = false }: { retiredToo?: boolean } = {},
): Promise<string | undefined> {
  const [row] = await db
    .select({ id: machine.id })
    .from(machine)
    .where(and(eq(machine.museumNumber, museumNumber), retiredToo ? undefined : isNull(machine.retiredAt)));
  return row?.id;
}

/**
 * What another module's page shows to name machines – the museum number and the machine model's title, by machine ID
 * (e.g. the triage list, ST-017; the page composes, ST-009). Retired machines included: their history stays readable.
 */
export async function machineLabels(
  db: Database,
  machineIds: readonly string[],
): Promise<Map<string, { museumNumber: string; machineModelTitle: string }>> {
  const unique = [...new Set(machineIds)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ id: machine.id, museumNumber: machine.museumNumber, machineModelTitle: machineModel.title })
    .from(machine)
    .innerJoin(machineModel, eq(machine.machineModelId, machineModel.id))
    .where(inArray(machine.id, unique));
  return new Map(rows.map(({ id, ...label }) => [id, label]));
}

/**
 * A machine as maintenance needs it (context map: Collection → Maintenance, Published Language): which machine, where
 * it stands, what kind of machine its machine model is – to decide which maintenance tasks apply –, since when its
 * machine model is of that kind (ST-036), and when it was registered, which can be its last done (ST-043).
 */
export type MachineForMaintenance = {
  id: string;
  museumNumber: string;
  machineModelTitle: string;
  location: string;
  machineCategory: MachineCategory;
  technology: Technology | undefined;
  /**
   * Its machine model's category history, the oldest first (ST-036): the machine category and technology from each
   * point in time on – a task that newly applies after a correction counts as last done on the correction date. The
   * first entry is always the machine model's creation (the migration gave every older model one).
   */
  categoryHistory: { machineCategory: MachineCategory; technology: Technology | undefined; holdsFrom: Date }[];
  registeredAt: Date;
  /** Its machine status now – a machine *Not on display* is never due (ST-056). */
  machineStatus: MachineStatus;
  /** When it last came back from *Not on display* – none if it never was (ST-056, HS-20). */
  returnedToDisplayAt: Date | undefined;
  /** Only machines still in the museum are listed – a fact the maintenance rules ask for (ST-044). */
  retired: false;
};

const NOT_ON_DISPLAY: MachineStatus = "not-on-display";

/**
 * Every machine that is not retired, as maintenance needs it (ST-043) – retired machines are never due. With
 * `machineId` only that machine, if it is not retired (the machine record, ST-047).
 */
export async function machinesForMaintenance(
  db: Database,
  { machineId }: { machineId?: string } = {},
): Promise<MachineForMaintenance[]> {
  const rows = await db
    .select({
      id: machine.id,
      museumNumber: machine.museumNumber,
      machineModelId: machine.machineModelId,
      machineModelTitle: machineModel.title,
      location: machine.location,
      machineCategory: machineModel.machineCategory,
      technology: machineModel.technology,
      registeredAt: machine.registeredAt,
      machineStatus: machine.machineStatus,
      // The latest change of the status history away from Not on display – the status as a typed parameter.
      returnedToDisplayAt: sql<Date | null>`(SELECT max(${machineStatusChange.changedAt}) FROM ${machineStatusChange}
        WHERE ${machineStatusChange.machineId} = ${machine.id}
          AND ${machineStatusChange.previousStatus} = ${NOT_ON_DISPLAY}
          AND ${machineStatusChange.newStatus} <> ${NOT_ON_DISPLAY})`.mapWith(machineStatusChange.changedAt),
    })
    .from(machine)
    .innerJoin(machineModel, eq(machine.machineModelId, machineModel.id))
    .where(and(isNull(machine.retiredAt), machineId === undefined ? undefined : eq(machine.id, machineId)));
  const histories = await categoryHistory.load(db, [...new Set(rows.map((row) => row.machineModelId))]);
  return rows.map(({ machineModelId, ...row }) => ({
    ...row,
    technology: row.technology ?? undefined,
    categoryHistory: (histories.get(machineModelId) ?? []).map(({ machineCategory, technology, holdsFrom }) => ({
      machineCategory,
      technology,
      holdsFrom,
    })),
    returnedToDisplayAt: row.returnedToDisplayAt ?? undefined,
    retired: false as const,
  }));
}

/**
 * One machine as maintenance needs it to check a maintenance record (context map, Collection → Maintenance: the
 * machine category and technology decide which maintenance tasks apply; a retired machine gets none, ST-044). Takes
 * the machine's retirement lock shared in a command (ADR 0010), so a retirement in flight decides first; a page reads
 * it with `{ inCommand: false }`. Undefined for an unknown machine.
 */
export async function machineForMaintenance(
  db: Database,
  machineId: string,
  { inCommand = true }: { inCommand?: boolean } = {},
): Promise<
  | {
      id: string;
      machineCategory: MachineCategory;
      technology: Technology | undefined;
      location: string;
      retired: boolean;
    }
  | undefined
> {
  if (!isId(machineId)) return undefined;
  if (inCommand) await retirementLock(db, machineId, "shared");
  const [row] = await db
    .select({
      id: machine.id,
      machineCategory: machineModel.machineCategory,
      technology: machineModel.technology,
      location: machine.location,
      retiredAt: machine.retiredAt,
    })
    .from(machine)
    .innerJoin(machineModel, eq(machine.machineModelId, machineModel.id))
    .where(eq(machine.id, machineId));
  return (
    row && {
      id: row.id,
      machineCategory: row.machineCategory,
      technology: row.technology ?? undefined,
      location: row.location,
      retired: row.retiredAt !== null,
    }
  );
}
