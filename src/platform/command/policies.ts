import type { Database } from "../database";
import type { PolicyCall, RunCall } from "./aggregate";
import type { Actor, Command, JournalEvent } from "./index";

/**
 * An automatic policy another module adds to a command (ADR 0010): its `POL-…` ID and the policy calls to make once
 * the command succeeded – read in the command's transaction, so it can find every aggregate it acts on. It gets the
 * triggering command's events (as they reach the journal) and the person who ran it. A `trigger` call runs as the
 * system; a `run` call runs as the person who ran the command, after that command's own authorization check – for a
 * policy whose command records who did it (ST-097: *Changed by* is the registering technician). A policy that acts on
 * many aggregates selects them `FOR UPDATE`, filtered by the state it acts on, so one changed a moment earlier is skipped.
 */
export type Policy<Error extends string> = {
  id: `POL-${string}`;
  calls: (
    tx: Database,
    triggered: { events: readonly JournalEvent[]; actor: Actor },
  ) => Promise<(PolicyCall<Error> | RunCall<Error>)[]>;
};

export function policy<Error extends string>(definition: Policy<Error>): Policy<Error> {
  return definition;
}

/**
 * The same command – same ID, same allowed actors – with policies of a downstream module added (ADR 0010): after it
 * succeeded with at least one event, each policy's calls run in the same transaction, in order – as the system, or as the
 * acting person for a `run`. A rejected policy rejects the whole command. The upstream module defines the command without
 * knowing who reacts; the module owning the policies' commands exports the result.
 */
export function withPolicies<Input, Result, Error extends string, PolicyError extends string>(
  command: Command<Input, Result, Error>,
  policies: readonly Policy<PolicyError>[],
): Command<Input, Result, Error | PolicyError> {
  return {
    id: command.id,
    allowedActors: command.allowedActors,
    removesContent: command.removesContent,
    mayChangeNothing: command.mayChangeNothing,
    run: async (input, context) => {
      const outcome = await command.run(input, context);
      if (!outcome.ok || outcome.events.length === 0) return outcome;
      for (const added of policies) {
        const calls = await added.calls(context.tx, { events: outcome.events, actor: context.actor });
        for (const call of calls) {
          if ("policy" in call) await context.runAsSystem(call.policy, call.input);
          else await context.run(call.command, call.input);
        }
      }
      return outcome;
    },
  };
}

/**
 * The command with policies bound to input of their own when the step is sent (HS-22, ST-097): the person chooses on
 * the triggering form what the policies act on – the maintenance tasks of a machine being registered –, but that choice is
 * no data of the command, whose module knows nothing of it. The step's input carries both side by side, `{ command,
 * policies }`; the command gets its own part, the policies are built from theirs (`withPolicies`, everything else alike).
 */
export function withPolicyInput<Input, Result, Error extends string, PolicyInput, PolicyError extends string>(
  command: Command<Input, Result, Error>,
  policiesFor: (input: PolicyInput) => readonly Policy<PolicyError>[],
): Command<{ command: Input; policies: PolicyInput }, Result, Error | PolicyError> {
  return {
    id: command.id,
    allowedActors: command.allowedActors,
    removesContent: command.removesContent,
    mayChangeNothing: command.mayChangeNothing,
    run: (input, context) => withPolicies(command, policiesFor(input.policies)).run(input.command, context),
  };
}
