import { and, eq, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Clock } from "../clock";
import type { Database } from "../database";
import { NotFound, VersionConflict } from "./errors";
import type { Actor, AllowedActor, Command, CommandContext, JournalEvent } from "./index";

/**
 * The one shape of a command (ST-071, architecture review 2026-09-27, Q2/Q11/Q12/Q14):
 *   load the aggregate (or nothing, for a creating command) → a pure decision → save → journal.
 * The decision sees the fresh state, so a domain rejection comes before a version conflict; saving checks the
 * version the acting person saw. State-based persistence, no event sourcing (ADR 0002).
 */

/** How a module stores one kind of aggregate. `aggregateStore` builds it; the version check lives only here. */
export type AggregateStore<State extends { id: string }> = {
  type: `AGG-${string}`;
  /** `lock`: hold the row until the transaction ends (for a policy, which has no version of its own to check). */
  load(tx: Database, id: string, options?: { lock?: boolean }): Promise<{ state: State; version: number } | undefined>;
  insert(tx: Database, state: State): Promise<void>;
  /** Saves at the expected version and increments it; false when the stored version differs. */
  update(tx: Database, state: State, expectedVersion: number): Promise<boolean>;
};

type VersionedTable = PgTable & { id: PgColumn; version: PgColumn };

export function aggregateStore<State extends { id: string }, T extends VersionedTable>(definition: {
  type: `AGG-${string}`;
  table: T;
  toState: (row: T["$inferSelect"]) => State;
  /** The row without its version – the store sets the version. */
  toRow: (state: State) => Omit<T["$inferInsert"], "version">;
}): AggregateStore<State> {
  const { type, table, toState, toRow } = definition;
  return {
    type,
    async load(tx, id, options) {
      const query = tx
        .select()
        .from(table as PgTable)
        .where(eq(table.id, id))
        .limit(1);
      const [row] = options?.lock ? await query.for("update") : await query;
      if (!row) return undefined;
      return { state: toState(row as T["$inferSelect"]), version: (row as { version: number }).version };
    },
    async insert(tx, state) {
      await tx.insert(table).values({ ...toRow(state), version: 0 } as never);
    },
    async update(tx, state, expectedVersion) {
      const updated = await tx
        .update(table)
        .set({ ...toRow(state), version: sql`${table.version} + 1` } as never)
        .where(and(eq(table.id, state.id), eq(table.version, expectedVersion)))
        .returning({ id: table.id });
      return updated.length > 0;
    },
  };
}

/** A new aggregate of the same module that a decision creates alongside its own (Q12, e.g. a defect during triage). */
export type Created = { store: AggregateStore<{ id: string }>; state: { id: string } };

export function created<State extends { id: string }>(store: AggregateStore<State>, state: State): Created {
  return { store: store as unknown as AggregateStore<{ id: string }>, state };
}

/** An automatic policy the command triggers after saving; it runs as the system in the same transaction. */
export type PolicyCall = { policy: Command<unknown, unknown, string>; input: unknown };

export function trigger<Input, Result, Error extends string>(
  policy: Command<Input, Result, Error>,
  input: Input,
): PolicyCall {
  return { policy: policy as unknown as Command<unknown, unknown, string>, input };
}

export type DecisionContext = { actor: Actor; clock: Clock; newId: () => string };

export type Decision<State, Event, Error extends string> =
  { ok: true; state: State; events: Event[]; created?: Created[] } | { ok: false; error: Error };

type Common<State extends { id: string }, Event, Result> = {
  id: `CMD-${string}`;
  allowedActors: readonly AllowedActor[];
  store: AggregateStore<State>;
  /** Maps a domain event onto its journal entry – references and non-personal facts only, never free text. */
  journal: (event: Event, state: State) => JournalEvent;
  result: (state: State) => Result;
  /** Automatic policies to run after saving, as the system, in the same transaction. */
  policies?: (state: State, events: Event[]) => PolicyCall[];
};

/** A creating command (Q14): no load, no version check – the new aggregate is saved at version 0. */
type Creating<Input, State extends { id: string }, Event, Result, Error extends string> = Common<
  State,
  Event,
  Result
> & {
  creates: true;
  decide: (state: undefined, input: Input, context: DecisionContext) => Decision<State, Event, Error>;
};

/**
 * A command on an existing aggregate: `target` names it and the version the acting person saw
 * (policies may leave the version out – then the freshly loaded one is used).
 */
type Changing<Input, State extends { id: string }, Event, Result, Error extends string> = Common<
  State,
  Event,
  Result
> & {
  creates?: false;
  target: (input: Input) => { id: string; version?: number };
  decide: (state: State, input: Input, context: DecisionContext) => Decision<State, Event, Error>;
};

export function aggregateCommand<Input, State extends { id: string }, Event, Result, Error extends string>(
  definition: Creating<Input, State, Event, Result, Error> | Changing<Input, State, Event, Result, Error>,
): Command<Input, Result, Error> {
  return {
    id: definition.id,
    allowedActors: definition.allowedActors,
    run: async (input: Input, context: CommandContext) => {
      const { tx, actor, clock, newId } = context;
      const decisionContext = { actor, clock, newId };
      const { store } = definition;

      let decision: Decision<State, Event, Error>;
      let expectedVersion: number | undefined;
      if (definition.creates) {
        decision = definition.decide(undefined, input, decisionContext);
      } else {
        const target = definition.target(input);
        // Without a version the acting person saw (a policy), lock the row: nobody saw a version to conflict with.
        const loaded = await store.load(tx, target.id, { lock: target.version === undefined });
        if (!loaded) throw new NotFound();
        // Decide on the fresh state first: a domain rejection explains more than a version conflict (Q11).
        decision = definition.decide(loaded.state, input, decisionContext);
        expectedVersion = target.version ?? loaded.version;
      }
      if (!decision.ok) return decision;
      // No events: nothing happened – nothing is saved and the version stays (e.g. a policy with nothing to do).
      if (decision.events.length === 0) return { ok: true, result: definition.result(decision.state), events: [] };

      // New aggregates cannot conflict with anyone; saving the command's own aggregate is the last step.
      for (const c of decision.created ?? []) await c.store.insert(tx, c.state);
      if (expectedVersion === undefined) await store.insert(tx, decision.state);
      else if (!(await store.update(tx, decision.state, expectedVersion))) throw new VersionConflict();

      for (const call of definition.policies?.(decision.state, decision.events) ?? []) {
        await context.runAsSystem(call.policy, call.input);
      }
      return {
        ok: true,
        result: definition.result(decision.state),
        events: decision.events.map((event) => definition.journal(event, decision.state)),
      };
    },
  };
}
