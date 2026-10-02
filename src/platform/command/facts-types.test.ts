import { describe, it } from "vitest";
import { aggregateCommand, type AggregateStore } from ".";

/** ST-007: a creating command whose decision needs facts (a set-based rule) must declare how they are read. */
type Thing = { id: string };
const things = {} as AggregateStore<Thing>;
const journal = () =>
  ({ type: "EVT-Test", aggregate: { type: "AGG-Test", id: "x" }, machineId: null, data: {} }) as const;
const decide = (facts: { taken: string[] }) => ({ ok: true as const, state: { id: facts.taken[0] }, events: [] });

describe("the facts of a creating command", () => {
  it("are required when the decision takes facts", () => {
    aggregateCommand({ id: "CMD-TestFacts", allowedActors: ["technician"], store: things, creates: true, facts: async () => ({ taken: ["x"] }), decide, journal, result: () => ({}) });
    // @ts-expect-error – the decision needs facts, so they must be read
    aggregateCommand({ id: "CMD-TestNoFacts", allowedActors: ["technician"], store: things, creates: true, decide, journal, result: () => ({}) });
  });
});
