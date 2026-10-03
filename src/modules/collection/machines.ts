import { and, asc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { aggregateStore, saveHistory, type AggregateStore, type Database } from "@/platform/command";
import type { MachineCategory, Technology } from "./create-machine-model";
import {
  machineStatuses,
  type Machine,
  type MachineStatus,
  type RegistrationFacts,
  type Retirement,
  type StatusChange,
} from "./register-machine";
import { machine, machineModel, machineStatusChange, museumNumber } from "./schema";

/**
 * How AGG-Machine is stored (ST-007): the machine row (versioned, HS-16), its status history, and its museum
 * number in the set of all museum numbers ever given out. A museum number row is never deleted – a corrected-away
 * number (ST-035) stays there as reserved, a retired machine keeps its own.
 */
const machineRows = aggregateStore({
  type: "AGG-Machine",
  table: machine,
  toState: (row): Machine => ({
    id: row.id,
    museumNumber: row.museumNumber,
    machineModelId: row.machineModelId,
    serialNumber: row.serialNumber ?? undefined,
    location: row.location,
    machineStatus: row.machineStatus,
    registeredAt: row.registeredAt,
    statusHistory: [], // loaded separately – see `machines.load`
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

export const machines: AggregateStore<Machine> = {
  type: "AGG-Machine",
  async load(tx, id, options) {
    const loaded = await machineRows.load(tx, id, options);
    if (!loaded) return undefined;
    return { ...loaded, state: { ...loaded.state, statusHistory: await statusHistoryOf(tx, id) } };
  },
  async insert(tx, state) {
    await machineRows.insert(tx, state);
    await giveOut(tx, state);
    await saveStatusHistory(tx, state);
  },
  async update(tx, state, expectedVersion) {
    if (!(await machineRows.update(tx, state, expectedVersion))) return false;
    await giveOut(tx, state);
    await saveStatusHistory(tx, state);
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

/** The status history is append-only (Q13): only the entries not stored yet are inserted. */
function saveStatusHistory(tx: Database, state: Machine): Promise<void> {
  return saveHistory(
    tx,
    { table: machineStatusChange, owner: "machineId" },
    state.id,
    state.statusHistory.map((change) => ({
      id: change.id,
      previousStatus: change.previousStatus ?? null,
      newStatus: change.newStatus,
      reason: change.reason,
      changedBy: change.changedBy,
      changedAt: change.changedAt,
    })),
  );
}

async function statusHistoryOf(db: Database, machineId: string): Promise<StatusChange[]> {
  const rows = await db
    .select()
    .from(machineStatusChange)
    .where(eq(machineStatusChange.machineId, machineId))
    .orderBy(asc(machineStatusChange.position));
  return rows.map((row) => ({
    id: row.id,
    previousStatus: row.previousStatus ?? undefined,
    newStatus: row.newStatus,
    reason: row.reason,
    changedBy: row.changedBy,
    changedAt: row.changedAt,
  }));
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
    input.machineModelId && isUuid(input.machineModelId)
      ? await tx.select({ id: machineModel.id }).from(machineModel).where(eq(machineModel.id, input.machineModelId))
      : [];
  return {
    museumNumbersGivenOut: givenOut.map((row) => row.museumNumber),
    machineModelExists: model.length > 0,
  } satisfies RegistrationFacts;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
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

/**
 * What the visitor machine page (RM-VisitorMachinePage, ST-010) shows of a machine – nothing internal. The machine ID
 * is there for the page data function only, which composes the Repair module's count with it and never passes it on.
 */
export type VisitorMachine = {
  machineId: string;
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
      machineId: machine.id,
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

/** A machine's status history, oldest first – module-internal, for this module's tests (the record shows it newest first). */
export function machineStatusHistory(db: Database, machineId: string): Promise<StatusChange[]> {
  return statusHistoryOf(db, machineId);
}

/** What the status change page (ST-012) shows of a machine, with the version the team member saw (HS-16). */
export type MachineForStatusChange = {
  id: string;
  museumNumber: string;
  machineStatus: MachineStatus;
  version: number;
  retired: boolean;
};

/** The machine whose status is about to change, by its museum number – retired ones included, so the page can say so. */
export async function machineForStatusChange(
  db: Database,
  museumNumber: string,
): Promise<MachineForStatusChange | undefined> {
  const [row] = await db
    .select({
      id: machine.id,
      museumNumber: machine.museumNumber,
      machineStatus: machine.machineStatus,
      version: machine.version,
      retiredAt: machine.retiredAt,
    })
    .from(machine)
    .where(eq(machine.museumNumber, museumNumber));
  return row && { id: row.id, museumNumber: row.museumNumber, machineStatus: row.machineStatus, version: row.version, retired: row.retiredAt !== null };
}

/**
 * What the Repair module needs to know about a machine when a problem is reported (context map, Collection → Repair:
 * Repair checks its command rules against the current machine state). Undefined for an unknown machine.
 */
export async function machineForReporting(
  db: Database,
  machineId: string,
): Promise<{ machineStatus: MachineStatus; retired: boolean } | undefined> {
  if (!isUuid(machineId)) return undefined;
  const [row] = await db
    .select({ machineStatus: machine.machineStatus, retiredAt: machine.retiredAt })
    .from(machine)
    .where(eq(machine.id, machineId));
  return row && { machineStatus: row.machineStatus, retired: row.retiredAt !== null };
}
