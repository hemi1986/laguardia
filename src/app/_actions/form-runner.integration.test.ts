import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { problemReportsOfMachine, reportProblemCommand } from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { journalOf, type Actor } from "@/platform/command";
import { commandErrorText, teamMessages, visitorMessages } from "@/platform/messages";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import sharp from "sharp";
import { memoryStorage } from "@/platform/storage";
import { withPhotoForTest } from "@/photo/photo-stand-in.test-support";
import { formRunner, photoFormRunner } from "./form-runner";
import { reportWithPriorityFields, reportWithPriorityForTest, reportWithPriorityInput } from "./stand-in.test-support";
import { aRegisteredMachine } from "@/test-support/machines";

/**
 * The Server Action runner (ST-073, architecture review Q9/Q10/Q19): the one way from a form to a command. Tested
 * through `formRunner` with the acting person `currentPerson()` would give; the real runner (`formAction`) binds
 * it to the login session.
 */
const db = testDatabase();
const clock = fixedClock("2026-09-29T10:00:00Z");

function runnerActingAs(actor: Actor) {
  return formRunner({ currentPerson: async () => actor, db, clock, newId: randomUUID });
}

function reportProblemFor(machineId: string, actor: Actor, succeeded: (id: string) => void = () => {}) {
  return runnerActingAs(actor)(reportProblemCommand, {
    fields: ["description"],
    input: ({ description }) => ({ machineId, description: description ?? "" }),
    onSuccess: async ({ problemReportId }) => succeeded(problemReportId),
  });
}

function post(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  return form;
}

describe("the Server Action runner", () => {
  it("returns the error code and the typed values on a rejection, and stores nothing", async () => {
    const machineId = await aRegisteredMachine(db);
    const action = reportProblemFor(machineId, { kind: "visitor" });

    const state = await action(null, post({ description: "   " }));

    expect(state).toEqual({ error: "description-required", values: { description: "   " } });
    expect(commandErrorText(visitorMessages("de"), state!.error)).toBe("Bitte beschreibe das Problem.");
    expect(await problemReportsOfMachine(db, machineId)).toEqual([]);
  });

  it("runs the command as the person currentPerson() gives – a visitor, or a team member", async () => {
    const technician = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
    await anExistingTeamMember(db, technician);
    const byVisitor: string[] = [];
    const byTechnician: string[] = [];

    expect(
      await reportProblemFor(await aRegisteredMachine(db), { kind: "visitor" }, (id) => byVisitor.push(id))(
        null,
        post({ description: "Left flipper is weak" }),
      ),
    ).toBeNull();
    await reportProblemFor(await aRegisteredMachine(db), technician, (id) => byTechnician.push(id))(
      null,
      post({ description: "Coil burnt" }),
    );

    expect((await journalOf(db, { aggregateId: byVisitor[0] })).map((e) => e.actor)).toEqual([{ kind: "visitor" }]);
    expect((await journalOf(db, { aggregateId: byTechnician[0] })).map((e) => e.actor)).toEqual([technician]);
  });

  it("ignores forged actor, role and team member fields – the person still comes from currentPerson()", async () => {
    const machineId = await aRegisteredMachine(db);
    const reported: string[] = [];
    const forged = post({
      description: "Forged report",
      actor: "system",
      role: "technician",
      teamMemberId: randomUUID(),
      kind: "team-member",
    });

    await reportProblemFor(machineId, { kind: "visitor" }, (id) => reported.push(id))(null, forged);

    expect((await journalOf(db, { aggregateId: reported[0] })).map((e) => e.actor)).toEqual([{ kind: "visitor" }]);
    const rejected = await reportProblemFor(machineId, { kind: "visitor" })(null, post({ description: "", role: "x" }));
    expect(rejected?.values).toEqual({ description: "" }); // only the form's own fields come back
  });

  it("rejects a post without the ID and enumeration fields through the command's decision, not an exception", async () => {
    const action = runnerActingAs({ kind: "visitor" })(reportWithPriorityForTest, {
      fields: reportWithPriorityFields,
      input: reportWithPriorityInput,
      onSuccess: async () => {},
    });

    const state = await action(null, post({}));

    expect(state).toEqual({ error: "machine-model-required", values: { machineModelId: "", priority: "" } });
    expect(commandErrorText(teamMessages, state!.error)).toBe("Bitte ein Modell wählen.");
  });

  it("has no parameter for an acting person, a role or a team member ID", () => {
    const runner = runnerActingAs({ kind: "visitor" });
    const definition = { fields: ["description"] as const, input: () => ({ machineId: "m", description: "" }) };

    // @ts-expect-error – the acting person comes only from currentPerson()
    runner(reportProblemCommand, { ...definition, onSuccess: async () => {} }, { kind: "visitor" });
    // @ts-expect-error – nor can a form definition carry one
    runner(reportProblemCommand, { ...definition, onSuccess: async () => {}, actor: { kind: "visitor" } });
  });

  describe("with a photo (ST-016, store, run, delete on failure)", () => {
    async function aPhoto(): Promise<File> {
      const jpeg = await sharp({ create: { width: 320, height: 240, channels: 3, background: "#c87828" } })
        .jpeg()
        .toBuffer();
      return new File([new Uint8Array(jpeg)], "photo.jpg", { type: "image/jpeg" });
    }

    function photoFormActingAs(actor: Actor, storage = memoryStorage(), succeeded: (photo?: string) => void = () => {}) {
      const action = photoFormRunner({ currentPerson: async () => actor, db, clock, newId: randomUUID, storage })(
        withPhotoForTest,
        {
          fields: ["outcome"],
          photo: { field: "photo", owner: "problem-reports" },
          input: ({ outcome }, photo) => ({ photo, outcome: outcome === "reject" ? ("reject" as const) : ("accept" as const) }),
          onSuccess: async ({ photo }) => succeeded(photo),
        },
      );
      return { action, storage };
    }

    it("runs the command with the stored photo's reference", async () => {
      const received: (string | undefined)[] = [];
      const { action, storage } = photoFormActingAs({ kind: "visitor" }, memoryStorage(), (photo) => received.push(photo));
      const form = post({ outcome: "accept" });
      form.append("photo", await aPhoto());

      expect(await action(null, form)).toBeNull();
      expect(received).toEqual(storage.names());
      expect(storage.names()).toHaveLength(1);
    });

    it("returns { error, values } when the command is rejected, and no photo stays stored", async () => {
      const { action, storage } = photoFormActingAs({ kind: "visitor" });
      const form = post({ outcome: "reject" });
      form.append("photo", await aPhoto());

      expect(await action(null, form)).toEqual({ error: "rejected-for-test", values: { outcome: "reject" } });
      expect(storage.names()).toEqual([]);
    });

    it("treats an empty file field as no photo", async () => {
      const received: (string | undefined)[] = [];
      const { action, storage } = photoFormActingAs({ kind: "visitor" }, memoryStorage(), (photo) => received.push(photo));
      const form = post({ outcome: "accept" });
      form.append("photo", new File([], ""));

      expect(await action(null, form)).toBeNull();
      expect(received).toEqual([undefined]);
      expect(storage.names()).toEqual([]);
    });
  });
});
