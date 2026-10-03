import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { systemClock, type Clock } from "../clock";
import { database, type Database } from "../database";
import { eventJournal } from "../schema";
import { NotFound, Rejected, VersionConflict } from "./errors";

/**
 * The command layer (ADR 0002, ST-003) – the one way every command runs:
 *   1. authorization: the acting person must be one the command allows – checked here, never only in middleware;
 *   2. one database transaction for the command's changes and its journal entries;
 *   3. a rejection or a version conflict rolls everything back – no change, no journal entry.
 * Commands get the clock and the ID generator injected, so they are deterministic in tests.
 * Commands are written with `aggregateCommand` (load → decide → save, `./aggregate.ts`) – the only public way.
 * Automatic policies run inside the triggering command's transaction as the system actor.
 * All commands are invoked through Server Actions (POST, Origin checked – the CSRF protection, src/proxy.ts).
 */

export type { Database } from "../database";
export {
  aggregateCommand,
  aggregateStore,
  created,
  trigger,
  type AggregateStore,
  type Decision,
  type DecisionContext,
} from "./aggregate";
export { saveHistory, type History } from "./history";

export type Role = "helper" | "technician";

/** The ID of a team member account – every "… by" of the domain (docs/architecture/data-model.md). */
export type TeamMemberId = string;

export type AllowedActor = Role | "visitor" | "system";

/**
 * The acting person a command with these allowed actors can get (Q5/Q20): `ActorOf<"helper" | "technician">` is a
 * team member with ID and role, without narrowing; `ActorOf<"visitor" | "technician">` also a visitor.
 */
export type ActorOf<Allowed extends AllowedActor> =
  | ([Extract<Allowed, Role>] extends [never]
      ? never
      : { kind: "team-member"; teamMemberId: TeamMemberId; role: Extract<Allowed, Role> })
  | ("visitor" extends Allowed ? { kind: "visitor" } : never)
  | ("system" extends Allowed ? { kind: "system" } : never);

/** Who acts: a team member with their role, an anonymous visitor, or the system (automatic policies). */
export type Actor = ActorOf<AllowedActor>;

/**
 * A domain event as the command hands it to the journal. The command's clock supplies the time.
 * `data` holds only references and non-personal facts (e.g. a new status or priority) – never free text a person
 * typed (descriptions, notes, reasons): the journal is append-only, so text there could never be removed
 * (spam dismissal, personal data). Pages read such text from the aggregate. Decided 2026-09-27 (ST-003 review).
 */
export type JournalEvent = {
  type: `EVT-${string}`;
  aggregate: { type: `AGG-${string}`; id: string };
  machineId: string | null;
  data: Record<string, unknown>;
};

export type CommandContext = {
  tx: Database;
  actor: Actor;
  clock: Clock;
  newId: () => string;
  /**
   * Runs an automatic policy (a command allowed for the system) in this command's transaction, journaled with
   * the system as actor. If the policy is rejected, the whole command is rejected with the policy's error.
   */
  runAsSystem: <Input, Result, Error extends string>(
    policy: Command<Input, Result, Error>,
    input: Input,
  ) => Promise<Result>;
};

export type CommandOutcome<Result, Error extends string> =
  { ok: true; result: Result; events: JournalEvent[] } | { ok: false; error: Error };

export type Command<Input, Result, Error extends string> = {
  id: `CMD-${string}`;
  allowedActors: readonly AllowedActor[];
  run: (input: Input, context: CommandContext) => Promise<CommandOutcome<Result, Error>>;
};

export type CommandResult<Result, Error extends string> =
  { ok: true; result: Result } | { ok: false; error: Error | "not-authorized" | "not-found" | "version-conflict" };

/** Every error a command can end with: its decision's own codes and those of the command layer. */
export type CommandError<C> = C extends Command<never, unknown, infer Error> ? CommandFailure<Error> : never;

type CommandFailure<Error extends string> = Extract<CommandResult<unknown, Error>, { ok: false }>["error"];

export type CommandDependencies = { actor: Actor; db?: Database; clock?: Clock; newId?: () => string };

export async function executeCommand<Input, Result, Error extends string>(
  command: Command<Input, Result, Error>,
  input: Input,
  { actor, db = database(), clock = systemClock, newId = randomUUID }: CommandDependencies,
): Promise<CommandResult<Result, Error>> {
  if (!command.allowedActors.includes(actorKind(actor))) return { ok: false, error: "not-authorized" };

  // One point in time per command: every event and every "… at" of the command (and its policies) carries it.
  const now = clock.now();
  const commandClock: Clock = { now: () => new Date(now) };

  try {
    const result = await db.transaction(async (tx) => {
      const { result, rows } = await runInTransaction(command, input, actor, { tx, clock: commandClock, newId });
      // Every command writes its journal entry (Definition of Done); only a policy may have nothing to do.
      if (rows.length === 0) throw new Error(`${command.id} succeeded but journals no event`);
      await tx.insert(eventJournal).values(rows);
      return result;
    });
    return { ok: true, result };
  } catch (error) {
    if (error instanceof Rejected) return { ok: false, error: error.reason as Error };
    if (error instanceof NotFound) return { ok: false, error: "not-found" };
    if (error instanceof VersionConflict) return { ok: false, error: "version-conflict" };
    throw error;
  }
}

type TransactionScope = { tx: Database; clock: Clock; newId: () => string };

type JournalRow = typeof eventJournal.$inferInsert;

/**
 * Runs a command inside an open transaction; a rejection throws (and rolls the transaction back).
 * Returns its journal rows in causal order: the command's own events, then those of the policies it triggered.
 */
async function runInTransaction<Input, Result, Error extends string>(
  command: Command<Input, Result, Error>,
  input: Input,
  actor: Actor,
  scope: TransactionScope,
): Promise<{ result: Result; rows: JournalRow[] }> {
  const policyRows: JournalRow[] = [];
  const outcome = await command.run(input, {
    ...scope,
    actor,
    runAsSystem: async (policy, policyInput) => {
      if (!policy.allowedActors.includes("system")) throw new Error(`${policy.id} is not an automatic policy`);
      const { result, rows } = await runInTransaction(policy, policyInput, { kind: "system" }, scope);
      policyRows.push(...rows);
      return result;
    },
  });
  if (!outcome.ok) throw new Rejected(outcome.error);
  const occurredAt = scope.clock.now();
  return {
    result: outcome.result,
    rows: [...outcome.events.map((e) => journalRow(e, actor, occurredAt)), ...policyRows],
  };
}

function actorKind(actor: Actor): AllowedActor {
  return actor.kind === "team-member" ? actor.role : actor.kind;
}

function journalRow(event: JournalEvent, actor: Actor, occurredAt: Date): JournalRow {
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
