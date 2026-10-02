import { asc, eq, isNull, sql } from "drizzle-orm";
import { aggregateStore, type AggregateStore, type Database } from "@/platform/command";
import type { Machine, MachineStatus, RegistrationFacts, StatusChange } from "./register-machine";
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
    retirement:
      row.retiredAt && row.retiredBy && row.retirementReason
        ? { reason: row.retirementReason, retiredBy: row.retiredBy, retiredAt: row.retiredAt }
        : undefined,
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
    await appendStatusChanges(tx, state, 0);
  },
  async update(tx, state, expectedVersion) {
    if (!(await machineRows.update(tx, state, expectedVersion))) return false;
    await giveOut(tx, state);
    const stored = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(machineStatusChange)
      .where(eq(machineStatusChange.machineId, state.id));
    await appendStatusChanges(tx, state, stored[0].count);
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

/** The status history only grows: entries beyond the ones stored are appended. */
async function appendStatusChanges(tx: Database, state: Machine, stored: number): Promise<void> {
  const added = state.statusHistory.slice(stored);
  if (added.length === 0) return;
  await tx.insert(machineStatusChange).values(
    added.map((change) => ({
      machineId: state.id,
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

/** One entry of the machine overview (RM-MachineOverview) as ST-007 shows it; ST-008 adds counts, filter, search. */
export type MachineOverviewEntry = {
  id: string;
  museumNumber: string;
  machineModelTitle: string;
  location: string;
  machineStatus: MachineStatus;
};

/** RM-MachineOverview: the active machines (not retired), sorted by museum number. */
export async function machineOverview(db: Database): Promise<MachineOverviewEntry[]> {
  return db
    .select({
      id: machine.id,
      museumNumber: machine.museumNumber,
      machineModelTitle: machineModel.title,
      location: machine.location,
      machineStatus: machine.machineStatus,
    })
    .from(machine)
    .innerJoin(machineModel, eq(machine.machineModelId, machineModel.id))
    .where(isNull(machine.retiredAt))
    .orderBy(asc(machine.museumNumber));
}

/** A machine's status history, oldest first – the machine record (RM-MachineRecord, ST-009) shows it. */
export function machineStatusHistory(db: Database, machineId: string): Promise<StatusChange[]> {
  return statusHistoryOf(db, machineId);
}
