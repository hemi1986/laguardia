import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formRunner } from "@/app/_actions/form-runner";
import { dismissProblemReportCommand, reportProblemCommand, triageList } from "@/modules/repair";
import { storedProblemReport } from "@/modules/repair/problem-report-stand-ins.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf } from "@/platform/command";
import { memoryStorage, type ContentStorage } from "@/platform/storage";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadProblemReport } from "../problem-report-data";
import { ProblemReportView } from "../problem-report";
import { dismissFields, dismissInput } from "./dismiss-input";

/**
 * The form „Meldung verwerfen“ (ST-020) through the Server Action runner, as a technician, with the in-memory storage
 * adapter: a spam dismissal removes the description and the photo, and deletes the stored photo after the commit.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-09T10:00:00Z");
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const ADVERTISEMENT = "Cheap watches at example.com – best prices!";
const PHOTO_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

afterEach(() => vi.restoreAllMocks());

async function aProblemReportWithPhoto(storage: ContentStorage) {
  await anExistingTeamMember(db, eva, "Eva");
  const machineId = await aRegisteredMachine(db);
  const photo = `problem-reports/${randomUUID()}.jpg`;
  await storage.write(photo, PHOTO_BYTES, "image/jpeg");
  const reported = await executeCommand(
    reportProblemCommand,
    { machineId, description: ADVERTISEMENT, photo },
    { actor: { kind: "visitor" }, db, clock, newId: randomUUID },
  );
  if (!reported.ok) throw new Error(reported.error);
  return { problemReportId: reported.result.problemReportId, photo };
}

function dismissForm(problemReportId: string, storage: ContentStorage) {
  return formRunner({ currentPerson: async () => eva, db, clock, newId: randomUUID, storage })(
    dismissProblemReportCommand,
    {
      fields: dismissFields,
      input: (fields) => dismissInput(fields, problemReportId),
      removesPhoto: (result) => result.removedPhoto,
      onSuccess: async () => {},
    },
  );
}

function post(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  return form;
}

describe("the form „Meldung verwerfen“", () => {
  it("ST-020: Dismissing as spam removes text and photo", async () => {
    const storage = memoryStorage();
    const { problemReportId, photo } = await aProblemReportWithPhoto(storage);

    const state = await dismissForm(problemReportId, storage)(null, post({ version: "0", reason: "spam" }));

    expect(state).toBeNull();
    const stored = await storedProblemReport(db, problemReportId);
    expect(stored?.description).toBeUndefined();
    expect(stored?.photo).toBeUndefined();
    expect(storage.read(photo)).toBeUndefined();
    expect(stored?.triage).toEqual({
      outcome: "dismissed",
      triagedBy: eva.teamMemberId,
      triagedAt: new Date("2026-10-09T10:00:00Z"),
      dismissal: { reason: "spam" },
    });
    expect((await journalOf(db, { aggregateId: problemReportId })).at(-1)).toMatchObject({
      type: "EVT-ProblemReportDismissed",
      data: { reason: "spam" },
    });
    expect((await triageList(db, clock)).map((listed) => listed.id)).not.toContain(problemReportId);

    const data = await loadProblemReport(db, clock, problemReportId, { storage });
    const html = renderToStaticMarkup(createElement(ProblemReportView, { data, role: "technician" }));
    expect(html).toContain("Als Spam verworfen – Beschreibung und Foto sind gelöscht.");
    expect(html).not.toContain("Cheap watches");
    expect(html).not.toContain("<img");
  });

  it("ST-020: Failed photo deletion does not undo the dismissal", async () => {
    const storage = memoryStorage();
    const { problemReportId, photo } = await aProblemReportWithPhoto(storage);
    const failing: ContentStorage = { ...storage, delete: () => Promise.reject(new Error("Blob is down")) };
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const state = await dismissForm(problemReportId, failing)(null, post({ version: "0", reason: "spam" }));

    expect(state).toBeNull();
    const stored = await storedProblemReport(db, problemReportId);
    expect(stored?.triage?.dismissal).toEqual({ reason: "spam" });
    expect(stored?.description).toBeUndefined();
    expect(stored?.photo).toBeUndefined();
    // Logged, so it can be deleted by hand – by its stored name, never with the text or the photo itself.
    expect(logged).toHaveBeenCalledTimes(1);
    const line = logged.mock.calls[0].map(String).join(" ");
    expect(line).toContain(photo);
    expect(line).toContain("Blob is down");
    expect(line).not.toContain("Cheap watches");
    expect(line).not.toContain(String(PHOTO_BYTES));
  });

  it("deletes nothing when the reason is not spam", async () => {
    const storage = memoryStorage();
    const { problemReportId, photo } = await aProblemReportWithPhoto(storage);

    const state = await dismissForm(problemReportId, storage)(null, post({ version: "0", reason: "not-a-fault" }));

    expect(state).toBeNull();
    expect(storage.read(photo)).toBeDefined();
    expect((await storedProblemReport(db, problemReportId))?.description).toBe(ADVERTISEMENT);
  });
});
