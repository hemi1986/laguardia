import { describe, expectTypeOf, it } from "vitest";
import { aggregateCommand, type ActorOf, type AggregateStore, type DecisionContext, type Role, type TeamMemberId } from ".";

/**
 * Architecture review 2026-09-27, Q5/Q20: the acting person a decision gets follows from the command's
 * `allowedActors` – a command for team members only gets a team member with ID and role, without narrowing.
 */
type Thing = { id: string };
const things = {} as AggregateStore<Thing>;
const journal = () =>
  ({ type: "EVT-Test", aggregate: { type: "AGG-Test", id: "x" }, machineId: null, data: {} }) as const;

describe("the acting person's type follows from the allowed actors", () => {
  it("a command for helpers and technicians gets a team member with team member ID and role", () => {
    aggregateCommand({
      id: "CMD-TestTeamOnly",
      allowedActors: ["helper", "technician"],
      store: things,
      creates: true,
      decide: (_state, _input: undefined, { actor }) => {
        expectTypeOf(actor).toEqualTypeOf<{ kind: "team-member"; teamMemberId: TeamMemberId; role: Role }>();
        return { ok: true, state: { id: actor.teamMemberId }, events: [] };
      },
      journal,
      result: () => undefined,
    });
  });

  it("a command that also allows visitors gets the union of visitor and team member", () => {
    aggregateCommand({
      id: "CMD-TestAnyone",
      allowedActors: ["visitor", "helper", "technician"],
      store: things,
      creates: true,
      decide: (_state, _input: undefined, { actor }) => {
        expectTypeOf(actor).toEqualTypeOf<
          { kind: "team-member"; teamMemberId: TeamMemberId; role: Role } | { kind: "visitor" }
        >();
        return { ok: true, state: { id: "x" }, events: [] };
      },
      journal,
      result: () => undefined,
    });
  });

  it("a decision written for team members only does not fit a command that allows visitors", () => {
    const teamOnly = (_state: undefined, _input: undefined, _context: DecisionContext<ActorOf<"technician">>) => ({
      ok: true as const,
      state: { id: "x" },
      events: [],
    });
    aggregateCommand({
      id: "CMD-TestMismatch",
      allowedActors: ["visitor", "technician"],
      store: things,
      creates: true,
      // @ts-expect-error – the decision cannot handle the visitor the command allows
      decide: teamOnly,
      journal,
      result: () => undefined,
    });
  });
});
