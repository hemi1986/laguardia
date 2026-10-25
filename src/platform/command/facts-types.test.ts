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
    aggregateCommand({
      id: "CMD-TestFacts",
      allowedActors: ["technician"],
      store: things,
      creates: true,
      facts: async () => ({ taken: ["x"] }),
      decide,
      journal,
      result: () => ({}),
    });
    // @ts-expect-error – the decision needs facts, so they must be read
    aggregateCommand({
      id: "CMD-TestNoFacts",
      allowedActors: ["technician"],
      store: things,
      creates: true,
      decide,
      journal,
      result: () => ({}),
    });
  });
});

/** ST-035: the same rule for a changing command – a decision that takes facts (its fourth argument) must read them. */
const decideOnThing = (thing: Thing, _input: { id: string; version: number }, _context: unknown, facts: { taken: string[] }) => ({
  ok: true as const,
  state: { id: thing.id + facts.taken.length },
  events: [],
});

describe("the facts of a changing command", () => {
  it("are required when the decision takes facts", () => {
    aggregateCommand({
      id: "CMD-TestChangingFacts",
      allowedActors: ["technician"],
      store: things,
      target: (input) => ({ id: input.id, version: input.version }),
      facts: async () => ({ taken: ["x"] }),
      decide: decideOnThing,
      journal,
      result: () => ({}),
    });
    // @ts-expect-error – the decision needs facts, so they must be read
    aggregateCommand({
      id: "CMD-TestChangingNoFacts",
      allowedActors: ["technician"],
      store: things,
      target: (input: { id: string; version: number }) => ({ id: input.id, version: input.version }),
      decide: decideOnThing,
      journal,
      result: () => ({}),
    });
  });
});
