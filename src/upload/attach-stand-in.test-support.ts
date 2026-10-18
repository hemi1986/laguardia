import { aggregateCommand, type AggregateStore } from "@/platform/command";

/**
 * Test stand-in for the attaching command (CMD-AttachFile comes with ST-037) – only imported by the upload module's
 * tests. It succeeds with the content name it received, is rejected when asked to, and throws when asked to; its store
 * keeps nothing.
 */
export type AttachInput = { content: string; outcome: "accept" | "reject" | "throw" };

const keepsNothing: AggregateStore<{ id: string; content: string }> = {
  type: "AGG-TestAttached",
  load: () => Promise.reject(new Error("the stand-in never loads")),
  insert: () => Promise.resolve(),
  update: () => Promise.reject(new Error("the stand-in never updates")),
};

export const attachForTest = aggregateCommand({
  id: "CMD-TestAttach",
  allowedActors: ["helper", "technician"],
  store: keepsNothing,
  creates: true,
  decide: (_nothingYet, input: AttachInput, { newId }) => {
    if (input.outcome === "throw") throw new Error("the stand-in command failed");
    if (input.outcome === "reject") return { ok: false as const, error: "rejected-for-test" as const };
    const state = { id: newId(), content: input.content };
    return { ok: true as const, state, events: [{ type: "EVT-TestAttached" as const, id: state.id }] };
  },
  journal: (event) => ({
    type: event.type,
    aggregate: { type: "AGG-TestAttached", id: event.id },
    machineId: null,
    data: {},
  }),
  result: (state) => ({ content: state.content }),
});
