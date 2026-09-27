import { randomUUID } from "node:crypto";
import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgTable, PgColumn } from "drizzle-orm/pg-core";
import { systemClock, type Clock } from "../clock";
import { database } from "../database";
import { eventJournal } from "../schema";

/**
 * The command layer (ADR 0002, ST-003) – the one way every command runs:
 *   1. authorization: the acting person must be one the command allows – checked here, never only in middleware;
 *   2. one database transaction for the command's changes and its journal entries;
 *   3. a rejection or a version conflict rolls everything back – no change, no journal entry.
 * Commands get the clock and the ID generator injected, so they are deterministic in tests.
 * All commands are invoked through Server Actions (POST, Origin checked by Next.js – the CSRF protection).
 */

/** A database handle or an open transaction – what persistence functions of the modules accept. */
export type Database = PgDatabase<NodePgQueryResultHKT>;

export type Role = "helper" | "technician";

/** Who acts: a team member with their role, an anonymous visitor, or the system (automatic policies). */
export type Actor =
  { kind: "team-member"; teamMemberId: string; role: Role } | { kind: "visitor" } | { kind: "system" };

export type AllowedActor = Role | "visitor" | "system";

/** A domain event as the command hands it to the journal. The command's clock supplies the time. */
export type JournalEvent = {
  type: `EVT-${string}`;
  aggregate: { type: `AGG-${string}`; id: string };
  machineId: string | null;
  data: Record<string, unknown>;
};

export type CommandContext = { tx: Database; actor: Actor; clock: Clock; newId: () => string };

export type CommandOutcome<Result, Error extends string> =
  { ok: true; result: Result; events: JournalEvent[] } | { ok: false; error: Error };

export type Command<Input, Result, Error extends string> = {
  id: `CMD-${string}`;
  allowedActors: readonly AllowedActor[];
  run: (input: Input, context: CommandContext) => Promise<CommandOutcome<Result, Error>>;
};

export type CommandResult<Result, Error extends string> =
  { ok: true; result: Result } | { ok: false; error: Error | "not-authorized" | "version-conflict" };

export function defineCommand<Input, Result, Error extends string>(
  command: Command<Input, Result, Error>,
): Command<Input, Result, Error> {
  return command;
}

export type CommandDependencies = { actor: Actor; db?: Database; clock?: Clock; newId?: () => string };

class Rejected extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

class VersionConflict extends Error {}

export async function executeCommand<Input, Result, Error extends string>(
  command: Command<Input, Result, Error>,
  input: Input,
  { actor, db = database(), clock = systemClock, newId = randomUUID }: CommandDependencies,
): Promise<CommandResult<Result, Error>> {
  if (!command.allowedActors.includes(actorKind(actor))) return { ok: false, error: "not-authorized" };

  // One point in time per command: every event and every "… at" of the command carries it.
  const now = clock.now();
  const commandClock: Clock = { now: () => new Date(now) };

  try {
    const result = await db.transaction(async (tx) => {
      const outcome = await command.run(input, { tx, actor, clock: commandClock, newId });
      if (!outcome.ok) throw new Rejected(outcome.error);
      if (outcome.events.length > 0) {
        await tx.insert(eventJournal).values(outcome.events.map((event) => journalRow(event, actor, now)));
      }
      return outcome.result;
    });
    return { ok: true, result };
  } catch (error) {
    if (error instanceof Rejected) return { ok: false, error: error.reason as Error };
    if (error instanceof VersionConflict) return { ok: false, error: "version-conflict" };
    throw error;
  }
}

function actorKind(actor: Actor): AllowedActor {
  return actor.kind === "team-member" ? actor.role : actor.kind;
}

function journalRow(event: JournalEvent, actor: Actor, occurredAt: Date): typeof eventJournal.$inferInsert {
  return {
    type: event.type,
    occurredAt,
    actorKind: actor.kind,
    actorTeamMemberId: actor.kind === "team-member" ? actor.teamMemberId : null,
    actorRole: actor.kind === "team-member" ? actor.role : null,
    aggregateType: event.aggregate.type,
    aggregateId: event.aggregate.id,
    machineId: event.machineId,
    data: event.data,
  };
}

type VersionedTable = PgTable & { id: PgColumn; version: PgColumn };

/**
 * Optimistic version check (HS-16): changes the aggregate only if it is still at the version the actor saw,
 * and increments the version. Otherwise the whole command is rejected with "version-conflict".
 * Of two concurrent commands at the same version, PostgreSQL lets the second wait for the first and then
 * finds no row at the old version.
 */
export async function updateAtVersion<T extends VersionedTable>(
  tx: Database,
  table: T,
  id: string,
  expectedVersion: number,
  changes: Partial<T["$inferInsert"]>,
): Promise<void> {
  const where: SQL | undefined = and(eq(table.id, id), eq(table.version, expectedVersion));
  const updated = await tx
    .update(table)
    .set({ ...changes, version: sql`${table.version} + 1` } as never)
    .where(where)
    .returning({ id: table.id });
  if (updated.length === 0) throw new VersionConflict();
}

export type JournalEntry = {
  type: string;
  occurredAt: Date;
  actor: Actor;
  aggregate: { type: string; id: string };
  machineId: string | null;
  data: Record<string, unknown>;
};

/** Journal entries of one aggregate or one machine, oldest first. */
export async function journalOf(
  db: Database,
  filter: { aggregateId: string } | { machineId: string },
): Promise<JournalEntry[]> {
  const rows = await db
    .select()
    .from(eventJournal)
    .where(
      "aggregateId" in filter
        ? eq(eventJournal.aggregateId, filter.aggregateId)
        : eq(eventJournal.machineId, filter.machineId),
    )
    .orderBy(asc(eventJournal.position));
  return rows.map((row) => ({
    type: row.type,
    occurredAt: row.occurredAt,
    actor: journalActor(row),
    aggregate: { type: row.aggregateType, id: row.aggregateId },
    machineId: row.machineId,
    data: row.data,
  }));
}

function journalActor(row: typeof eventJournal.$inferSelect): Actor {
  if (row.actorKind !== "team-member") return { kind: row.actorKind };
  if (!row.actorTeamMemberId || !row.actorRole)
    throw new Error(`Journal entry ${row.position}: team member without ID or role`);
  return { kind: "team-member", teamMemberId: row.actorTeamMemberId, role: row.actorRole };
}
