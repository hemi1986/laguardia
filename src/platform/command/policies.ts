import type { Database } from "../database";
import type { PolicyCall } from "./aggregate";
import type { Actor, Command, JournalEvent } from "./index";

/**
 * An automatic policy another module adds to a command (ADR 0010): its `POL-…` ID and the policy calls to make once
 * the command succeeded – read in the command's transaction, so it can find every aggregate it acts on. It gets the
 * triggering command's events (as they reach the journal) and the person who ran it; each call runs as the system. A policy that acts on many aggregates
 * selects them `FOR UPDATE`, filtered by the state it acts on, so one changed a moment earlier is skipped.
 */
export type Policy<Error extends string> = {
  id: `POL-${string}`;
  calls: (tx: Database, triggered: { events: readonly JournalEvent[]; actor: Actor }) => Promise<PolicyCall<Error>[]>;
};

export function policy<Error extends string>(definition: Policy<Error>): Policy<Error> {
  return definition;
}

/**
 * The same command – same ID, same allowed actors – with policies of a downstream module added (ADR 0010): after it
 * succeeded with at least one event, each policy's calls run in the same transaction as the system, in order. A
 * rejected policy rejects the whole command. The upstream module defines the command without knowing who reacts; the
 * module owning the policies' commands exports the result.
 */
export function withPolicies<Input, Result, Error extends string, PolicyError extends string>(
  command: Command<Input, Result, Error>,
  policies: readonly Policy<PolicyError>[],
): Command<Input, Result, Error | PolicyError> {
  return {
    id: command.id,
    allowedActors: command.allowedActors,
    run: async (input, context) => {
      const outcome = await command.run(input, context);
      if (!outcome.ok || outcome.events.length === 0) return outcome;
      for (const added of policies) {
        const calls = await added.calls(context.tx, { events: outcome.events, actor: context.actor });
        for (const call of calls) await context.runAsSystem(call.policy, call.input);
      }
      return outcome;
    },
  };
}
