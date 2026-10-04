import { aggregateCommand, type AggregateStore } from "@/platform/command";

/**
 * Test stand-in for a command that takes a photo reference (ST-016) – only imported by the photo module's tests. It
 * succeeds with the reference it received, is rejected when asked to, and throws when asked to; its store keeps nothing.
 */
export type WithPhotoInput = { photo: string | undefined; outcome: "accept" | "reject" | "throw" };

const keepsNothing: AggregateStore<{ id: string; photo: string | undefined }> = {
  type: "AGG-TestWithPhoto",
  load: () => Promise.reject(new Error("the stand-in never loads")),
  insert: () => Promise.resolve(),
  update: () => Promise.reject(new Error("the stand-in never updates")),
};

function standInWithPhoto<const Allowed extends readonly ("visitor" | "helper" | "technician" | "system")[]>(
  id: `CMD-${string}`,
  allowedActors: Allowed,
) {
  return aggregateCommand({
    id,
    allowedActors,
    store: keepsNothing,
    creates: true,
    decide: (_nothingYet, input: WithPhotoInput, { newId }) => {
      if (input.outcome === "throw") throw new Error("the stand-in command failed");
      if (input.outcome === "reject") return { ok: false as const, error: "rejected-for-test" as const };
      const state = { id: newId(), photo: input.photo };
      return { ok: true as const, state, events: [{ type: "EVT-TestStoredWithPhoto" as const, id: state.id }] };
    },
    journal: (event) => ({ type: event.type, aggregate: { type: "AGG-TestWithPhoto", id: event.id }, machineId: null, data: {} }),
    result: (state) => ({ photo: state.photo }),
  });
}

/** Allowed for visitors and team members, like CMD-ReportProblem. */
export const withPhotoForTest = standInWithPhoto("CMD-TestWithPhoto", ["visitor", "helper", "technician"]);

/** Allowed for technicians only – a visitor gets `not-authorized` before the command runs. */
export const techniciansOnlyWithPhotoForTest = standInWithPhoto("CMD-TestTechniciansOnlyWithPhoto", ["technician"]);
