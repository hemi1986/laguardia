import { describe, expectTypeOf, it } from "vitest";
import { aggregateCommand, run, type AggregateStore, type Command, type CommandError } from ".";

/**
 * `context.run` (ST-018, architecture review Q6): the errors of a command another one runs are part of the outer
 * command's result type – a form showing the outer command's errors must have a text for the inner ones too.
 */
type Thing = { id: string };
const things = {} as AggregateStore<Thing>;
const journal = () =>
  ({ type: "EVT-Test", aggregate: { type: "AGG-Test", id: "x" }, machineId: null, data: {} }) as const;

const inner = {} as Command<{ reason: string }, void, "reason-required" | "machine-retired">;

describe("the result type of a command that runs another", () => {
  it("includes the inner command's errors besides its own and the layer's", () => {
    const outer = aggregateCommand({
      id: "CMD-TestOuter",
      allowedActors: ["technician"],
      store: things,
      creates: true,
      decide: (_facts, _input: { title: string }, { newId }) =>
        Math.random() > 2
          ? { ok: false as const, error: "title-required" as const }
          : { ok: true as const, state: { id: newId() }, events: [{ type: "EVT-Test" as const }] },
      journal,
      runs: () => [run(inner, { reason: "x" })],
      result: () => undefined,
    });

    expectTypeOf<CommandError<typeof outer>>().toEqualTypeOf<
      "title-required" | "reason-required" | "machine-retired" | "not-authorized" | "not-found" | "version-conflict"
    >();
  });
});
