import { describe, expect, it } from "vitest";
import type { Command } from "./index";
import { withPolicies, withPolicyInput } from "./policies";

/**
 * A command with policies added is the same command (ADR 0010, architecture review 2026-10-30): every property the
 * command has – its ID, its allowed actors, the content it removes, that it may change nothing – survives both ways of
 * adding them, so a property a command gains later cannot be lost on the way.
 */
describe("a command with policies added", () => {
  const command: Command<{ name: string }, { name: string }, "rejected"> = {
    id: "CMD-TestSomething",
    allowedActors: ["technician"],
    removesContent: (result) => result.name,
    mayChangeNothing: true,
    run: async () => ({ ok: true, state: undefined, events: [], result: { name: "file" } }) as never,
  };

  it.each([
    ["withPolicies", withPolicies(command, [])],
    ["withPolicyInput", withPolicyInput(command, () => [])],
  ] as const)("keeps every property of the command – %s", (_how, added) => {
    expect(Object.keys(added).sort()).toEqual(["allowedActors", "id", "mayChangeNothing", "removesContent", "run"]);
    expect(added).toMatchObject({ id: "CMD-TestSomething", allowedActors: ["technician"], mayChangeNothing: true });
    expect(added.removesContent?.({ name: "file" })).toBe("file");
    expect(added.run).not.toBe(command.run);
  });
});
