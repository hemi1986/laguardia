import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import {
  claimDefectCommand,
  linkProblemReportToDefectCommand,
  logWorkCommand,
  prioritizeDefectCommand,
  putDefectOnHoldCommand,
  recordDefectCommand,
  releaseClaimCommand,
  reportProblemCommand,
  resolveDefectCommand,
} from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { executeCommand, type Actor } from "@/platform/command";
import { memoryStorage } from "@/platform/storage";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadDefectDetails } from "./defect-details-data";
import { DefectDetailsView } from "./defect-details";

/**
 * A defect's own page (ST-021): Repair's defect and its problem reports with Collection's museum number and title and
 * Team's names – the page composes (ST-009). In a database of its own, so the machine can be "LG-042".
 */
const isolated = isolatedTestDatabase("defect_details");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const visitor: Actor = { kind: "visitor" };
const NOW = "2026-10-04T10:00:00Z";
let medievalMadness: string;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  const created = await executeCommand(
    createMachineModelCommand,
    { title: "Medieval Madness", manufacturer: "Williams", machineCategory: "pinball" },
    { actor: tom, db, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  medievalMadness = created.result.machineModelId;
});

afterAll(() => isolated.close());

beforeEach(() => withoutMachines(db));

async function registered(museumNumber: string) {
  const outcome = await executeCommand(
    registerMachineCommand,
    {
      machineModelId: medievalMadness,
      museumNumber,
      serialNumber: undefined,
      location: "Hall 2",
      machineStatus: "playable",
    },
    { actor: tom, db, newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.machineId;
}

async function reported(machineId: string, description: string, at: string, actor: Actor = visitor, photo?: string) {
  const outcome = await executeCommand(
    reportProblemCommand,
    { machineId, description, photo },
    { actor, db, clock: fixedClock(at), newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.problemReportId;
}

async function recorded(problemReportId: string, at: string) {
  const outcome = await executeCommand(
    recordDefectCommand,
    {
      problemReportId,
      version: 0,
      title: "Left flipper weak",
      priority: "high",
      suitableForHelpers: true,
      machineStatus: undefined,
      machineVersion: undefined,
    },
    { actor: tom, db, clock: fixedClock(at), newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.defectId;
}

async function page(defectId: string): Promise<string> {
  return renderToStaticMarkup(
    createElement(DefectDetailsView, { details: await loadDefectDetails(db, fixedClock(NOW), defectId) }),
  );
}

describe("a defect's own page", () => {
  it("ST-021: Team member opens a defect", async () => {
    const lg042 = await registered("LG-042");
    const report = await reported(lg042, "Left flipper barely moves", "2026-09-29T09:30:00Z");
    const defectId = await recorded(report, "2026-09-29T10:00:00Z");

    const details = await loadDefectDetails(db, fixedClock(NOW), defectId);

    expect(details).toMatchObject({
      museumNumber: "LG-042",
      machineModelTitle: "Medieval Madness",
      title: "Left flipper weak",
      priority: "high",
      suitableForHelpers: true,
      recordedAt: new Date("2026-09-29T10:00:00Z"),
      openDays: 5,
      problemReports: [
        {
          originating: true,
          description: "Left flipper barely moves",
          reporter: { kind: "visitor" },
          reportedAt: new Date("2026-09-29T09:30:00Z"),
        },
      ],
    });
    const html = await page(defectId);
    expect(html).toContain("Left flipper weak");
    expect(html).toMatch(/<a [^>]*href="\/team\/machines\/LG-042"[^>]*>LG-042 · Medieval Madness<\/a>/);
    expect(html).toContain("Priorität: hoch");
    expect(html).toContain("Für Helfer:innen geeignet");
    expect(html).toContain("Erfasst am 29.09.2026, 12:00 · offen seit 5 Tagen");
    expect(html).toContain("Ursprüngliche Meldung");
    expect(html).toContain("Left flipper barely moves");
    expect(html).toContain("Besucher:in · 29.09.2026, 11:30");
  });

  it("ST-021: Defect details show all linked problem reports", async () => {
    const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
    await anExistingTeamMember(db, anna, "Anna");
    const lg042 = await registered("LG-042");
    const defectId = await recorded(
      await reported(lg042, "Left flipper barely moves", "2026-09-29T09:30:00Z"),
      "2026-09-29T10:00:00Z",
    );
    for (const [description, at, actor] of [
      ["Flipper does not hold the ball", "2026-10-02T14:00:00Z", visitor],
      ["Left flipper sticks", "2026-10-01T08:15:00Z", anna],
    ] as const) {
      const linked = await executeCommand(
        linkProblemReportToDefectCommand,
        { problemReportId: await reported(lg042, description, at, actor), version: 0, defectId },
        { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
      );
      if (!linked.ok) throw new Error(linked.error);
    }
    await reported(lg042, "Coin door jammed", "2026-10-03T08:00:00Z");

    const details = await loadDefectDetails(db, fixedClock(NOW), defectId);

    expect(
      details?.problemReports.map(({ originating, description, reporter, reportedAt }) => ({
        originating,
        description,
        reporter,
        reportedAt,
      })),
    ).toEqual([
      {
        originating: true,
        description: "Left flipper barely moves",
        reporter: { kind: "visitor" },
        reportedAt: new Date("2026-09-29T09:30:00Z"),
      },
      {
        originating: false,
        description: "Left flipper sticks",
        reporter: { kind: "team-member", name: "Anna" },
        reportedAt: new Date("2026-10-01T08:15:00Z"),
      },
      {
        originating: false,
        description: "Flipper does not hold the ball",
        reporter: { kind: "visitor" },
        reportedAt: new Date("2026-10-02T14:00:00Z"),
      },
    ]);
    const html = await page(defectId);
    expect(html).toContain("Anna · 01.10.2026, 10:15");
    expect(html).toContain("Besucher:in · 02.10.2026, 16:00");
    expect(html.match(/Verknüpfte Meldung/g)).toHaveLength(2);
    expect(html).not.toContain("Coin door jammed");
  });

  it("does not call a defect open that is no longer open", async () => {
    const lg042 = await registered("LG-042");
    const defectId = await recorded(
      await reported(lg042, "Left flipper barely moves", "2026-09-29T09:30:00Z"),
      "2026-09-29T10:00:00Z",
    );
    const resolved = await executeCommand(
      resolveDefectCommand,
      { defectId, version: 0, closingNote: "Fixed" },
      { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
    );
    if (!resolved.ok) throw new Error(resolved.error);

    const html = await page(defectId);

    expect(html).toContain("Erfasst am 29.09.2026, 12:00");
    expect(html).not.toContain("offen seit");
  });

  it("says that a defect does not exist, for an unknown ID or an address that is no ID", async () => {
    expect(await loadDefectDetails(db, fixedClock(NOW), randomUUID())).toBeUndefined();
    expect(await loadDefectDetails(db, fixedClock(NOW), "not-an-id")).toBeUndefined();
    expect(await page("not-an-id")).toContain("Diesen Defekt gibt es nicht.");
  });

  describe("its claim (ST-025)", () => {
    const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
    const asTom = { id: tom.teamMemberId, role: tom.role };
    const asAnna = { id: anna.teamMemberId, role: anna.role };

    async function claimed(defectId: string, version: number, actor: Actor) {
      const outcome = await executeCommand(
        claimDefectCommand,
        { defectId, version },
        { actor, db, clock: fixedClock(NOW), newId: randomUUID },
      );
      if (!outcome.ok) throw new Error(outcome.error);
    }

    /** The page as that team member sees it: its claim data, and the rendered view just back from claiming. */
    async function seenBy(defectId: string, viewer: typeof asTom | typeof asAnna) {
      const details = await loadDefectDetails(db, fixedClock(NOW), defectId, {
        storage: memoryStorage(),
        viewer,
        done: "claim",
      });
      const html = renderToStaticMarkup(createElement(DefectDetailsView, { details }));
      return {
        claimant: details?.claimant,
        canClaim: details?.offered.includes("claim"),
        version: details?.version,
        html,
      };
    }

    it("offers an unclaimed defect to everyone who may claim it, and confirms nothing nobody did", async () => {
      await anExistingTeamMember(db, anna, "Anna");
      const defectId = await recorded(
        await reported(await registered("LG-042"), "Left flipper barely moves", NOW),
        NOW,
      );

      for (const viewer of [asTom, asAnna]) {
        const page = await seenBy(defectId, viewer);
        expect(page).toMatchObject({ claimant: undefined, canClaim: true, version: 0 });
        // The address alone (`?done=claim`) makes the page say nothing.
        expect(page.html).not.toContain("bernommen");
      }
    });

    it("names the claimant, tells the claimant so, and offers taking over to everyone else", async () => {
      await anExistingTeamMember(db, anna, "Anna");
      const defectId = await recorded(
        await reported(await registered("LG-042"), "Left flipper barely moves", NOW),
        NOW,
      );
      await claimed(defectId, 0, tom);

      const toms = await seenBy(defectId, asTom);
      expect(toms).toMatchObject({ claimant: { name: "Tom", you: true }, canClaim: false, version: 1 });
      expect(toms.html).toContain("Du hast „Left flipper weak“ übernommen.");
      expect(toms.html).not.toContain("Vorher:");
      expect(toms.html).toContain("Von dir übernommen");
      const annas = await seenBy(defectId, asAnna);
      expect(annas).toMatchObject({ claimant: { name: "Tom", you: false }, canClaim: true });
      expect(annas.html).toContain("Übernommen von Tom");
      expect(annas.html).not.toContain("Du hast");

      await claimed(defectId, 1, anna);

      const afterTakeover = await seenBy(defectId, asAnna);
      expect(afterTakeover.html).toContain("Du hast „Left flipper weak“ übernommen. Vorher: Tom.");
      expect((await seenBy(defectId, asTom)).html).toContain("Übernommen von Anna");
    });

    it("offers no claim on a resolved defect", async () => {
      const defectId = await recorded(
        await reported(await registered("LG-042"), "Left flipper barely moves", NOW),
        NOW,
      );
      const resolved = await executeCommand(
        resolveDefectCommand,
        { defectId, version: 0, closingNote: "Fixed" },
        { actor: tom, db, newId: randomUUID },
      );
      if (!resolved.ok) throw new Error("not resolved");

      expect((await seenBy(defectId, asTom)).canClaim).toBe(false);
    });
  });

  describe("assigning it and releasing its claim (ST-026, G22)", () => {
    const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
    const ben = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
    const asTom = { id: tom.teamMemberId, role: tom.role };
    const asAnna = { id: anna.teamMemberId, role: anna.role };
    const asBen = { id: ben.teamMemberId, role: ben.role };

    /** The page as that team member sees it, just back from the given action. */
    async function seenBy(defectId: string, viewer: typeof asTom | typeof asAnna, done?: string) {
      const details = await loadDefectDetails(db, fixedClock(NOW), defectId, {
        storage: memoryStorage(),
        viewer,
        done,
      });
      return { offered: details?.offered, html: renderToStaticMarkup(createElement(DefectDetailsView, { details })) };
    }

    async function aDefect() {
      await anExistingTeamMember(db, anna, "Anna");
      await anExistingTeamMember(db, ben, "Ben");
      return recorded(await reported(await registered("LG-042"), "Left flipper barely moves", NOW), NOW);
    }

    it("offers assigning behind „Verwalten“ to technicians only, and releasing to nobody while it is unclaimed", async () => {
      const defectId = await aDefect();

      const toms = await seenBy(defectId, asTom);
      expect(toms.offered).toEqual(["claim", "log-work", "put-on-hold", "resolve", "assign", "prioritize"]);
      expect(toms.html).toMatch(/<details[^>]*><summary[^>]*>Verwalten/);
      expect(toms.html).toContain(`href="/team/defects/${defectId}/zuweisen"`);
      const annas = await seenBy(defectId, asAnna);
      expect(annas.offered).toEqual(["claim", "log-work", "resolve"]);
      expect(annas.html).not.toContain("Verwalten");
      expect(annas.html).not.toContain("zuweisen");
    });

    it("says who assigned it, to the one who did and to the one it was assigned to", async () => {
      const defectId = await aDefect();
      const assigned = await executeCommand(
        claimDefectCommand,
        { defectId, version: 0, assignTo: anna.teamMemberId },
        { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
      );
      if (!assigned.ok) throw new Error(assigned.error);

      const toms = await seenBy(defectId, asTom, "assign");
      expect(toms.html).toContain("Du hast „Left flipper weak“ Anna zugewiesen.");
      expect(toms.html).toContain("Übernommen von Anna");
      expect(toms.html).toContain("Von dir zugewiesen");
      // A technician may take it over, assign it to someone else, or release Anna's claim.
      expect(toms.offered).toEqual(["claim", "release", "log-work", "put-on-hold", "resolve", "assign", "prioritize"]);
      const annas = await seenBy(defectId, asAnna, "assign");
      expect(annas.html).toContain("Von dir übernommen");
      expect(annas.html).toContain("Zugewiesen von Tom");
      expect(annas.html).not.toContain("Du hast");
      // Her own claim: she may release it, not claim it again.
      expect(annas.offered).toEqual(["release", "log-work", "put-on-hold", "resolve"]);
      // Another helper may take it over, but not release it.
      expect((await seenBy(defectId, asBen)).offered).toEqual(["claim", "log-work", "resolve"]);

      // Assigned on, the confirmation names who had it.
      const reassigned = await executeCommand(
        claimDefectCommand,
        { defectId, version: 1, assignTo: ben.teamMemberId },
        { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
      );
      if (!reassigned.ok) throw new Error(reassigned.error);
      expect((await seenBy(defectId, asTom, "assign")).html).toContain(
        "Du hast „Left flipper weak“ Ben zugewiesen. Vorher: Anna.",
      );
      // An assignment is not confirmed as a claim of one's own.
      expect((await seenBy(defectId, asTom, "claim")).html).not.toContain("Du hast");
    });

    it("tells who released a claim that the defect is free again, and names no claimant any more", async () => {
      const defectId = await aDefect();
      for (const [command, version] of [
        [claimDefectCommand, 0],
        [releaseClaimCommand, 1],
      ] as const) {
        const outcome = await executeCommand(
          command,
          { defectId, version },
          { actor: anna, db, clock: fixedClock(NOW), newId: randomUUID },
        );
        if (!outcome.ok) throw new Error(outcome.error);
      }

      const annas = await seenBy(defectId, asAnna, "release");
      expect(annas.html).toContain("„Left flipper weak“ ist wieder frei.");
      expect(annas.html).not.toContain("bernommen");
      expect(annas.offered).toEqual(["claim", "log-work", "resolve"]);
      expect((await seenBy(defectId, asTom, "release")).html).not.toContain("wieder frei");
    });
  });

  describe("changing its priority (ST-027, G22)", () => {
    const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
    const asTom = { id: tom.teamMemberId, role: tom.role };
    const asAnna = { id: anna.teamMemberId, role: anna.role };

    /** The page as that team member sees it, just back from the given action. */
    async function seenBy(defectId: string, viewer: typeof asTom | typeof asAnna, done?: string) {
      const details = await loadDefectDetails(db, fixedClock(NOW), defectId, { storage: memoryStorage(), viewer, done });
      return { offered: details?.offered, html: renderToStaticMarkup(createElement(DefectDetailsView, { details })) };
    }

    it("offers „Priorität ändern“ behind „Verwalten“ to technicians only, and confirms the new priority", async () => {
      await anExistingTeamMember(db, anna, "Anna");
      const defectId = await recorded(await reported(await registered("LG-042"), "Display flickers", NOW), NOW);

      const toms = await seenBy(defectId, asTom);
      expect(toms.offered).toContain("prioritize");
      const fold = toms.html.slice(toms.html.indexOf("<details"));
      expect(fold).toMatch(new RegExp(`<a [^>]*href="/team/defects/${defectId}/prioritaet"[^>]*>Priorität ändern</a>`));
      const annas = await seenBy(defectId, asAnna);
      expect(annas.offered).not.toContain("prioritize");
      expect(annas.html).not.toContain("prioritaet");

      const lowered = await executeCommand(
        prioritizeDefectCommand,
        { defectId, version: 0, priority: "low" },
        { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
      );
      if (!lowered.ok) throw new Error(lowered.error);
      const after = await seenBy(defectId, asTom, "prioritize");
      expect(after.html).toContain("„Left flipper weak“ hat jetzt die Priorität niedrig.");
      expect(after.html).toContain("Priorität: niedrig");
      expect((await seenBy(defectId, asAnna, "prioritize")).html).not.toContain("hat jetzt die Priorität");
    });
  });

  describe("its hold (ST-029, G22)", () => {
    const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
    const asTom = { id: tom.teamMemberId, role: tom.role };
    const asAnna = { id: anna.teamMemberId, role: anna.role };

    /** The page as that team member sees it, just back from the given action – with the one-tap form of resuming. */
    async function seenBy(defectId: string, viewer: typeof asTom | typeof asAnna, done?: string) {
      const details = await loadDefectDetails(db, fixedClock(NOW), defectId, { storage: memoryStorage(), viewer, done });
      const html = renderToStaticMarkup(
        createElement(DefectDetailsView, { details, resumeAction: async () => null }),
      );
      return { offered: details?.offered, html };
    }

    it("offers „Pausieren“, then says the hold in the header and offers „Fortsetzen“ in its place, confirming both", async () => {
      await anExistingTeamMember(db, anna, "Anna");
      const defectId = await recorded(await reported(await registered("LG-042"), "Display flickers", NOW), NOW);

      const before = await seenBy(defectId, asTom);
      expect(before.html).toMatch(new RegExp(`<a [^>]*href="/team/defects/${defectId}/pausieren"[^>]*>Pausieren</a>`));
      expect(before.html).not.toContain("Fortsetzen");
      // A helper who has not claimed it is offered neither (G11).
      expect((await seenBy(defectId, asAnna)).offered).not.toContain("put-on-hold");

      const held = await executeCommand(
        putDefectOnHoldCommand,
        { defectId, version: 0, reason: "waiting-for-part", note: "Ordered new flyback" },
        { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
      );
      if (!held.ok) throw new Error(held.error);

      const after = await seenBy(defectId, asTom, "put-on-hold");
      expect(after.html).toContain("„Left flipper weak“ ist pausiert – Wartet auf Ersatzteil.");
      expect(after.html).toContain("Pausiert – Wartet auf Ersatzteil · Ordered new flyback");
      expect(after.html).not.toContain("pausieren\"");
      expect(after.offered).toContain("resume");
      expect(after.html).toContain(">Fortsetzen</button>");
      // Only who just did it is told so (G3).
      expect((await seenBy(defectId, asAnna, "put-on-hold")).html).not.toContain("ist pausiert");
    });
  });

  describe("its work log (ST-024)", () => {
    const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
    const asAnna = { id: anna.teamMemberId, role: anna.role };

    async function logged(
      defectId: string,
      version: number,
      actor: Actor,
      at: string,
      whatWasDone: string,
      partsUsed = "",
    ) {
      const outcome = await executeCommand(
        logWorkCommand,
        { defectId, version, whatWasDone, partsUsed },
        { actor, db, clock: fixedClock(at), newId: randomUUID },
      );
      if (!outcome.ok) throw new Error(outcome.error);
    }

    async function seenByAnna(defectId: string, justLoggedWork = false) {
      const details = await loadDefectDetails(db, fixedClock("2026-10-08T10:00:00Z"), defectId, {
        storage: memoryStorage(),
        viewer: asAnna,
        done: justLoggedWork ? "log-work" : undefined,
      });
      return { details, html: renderToStaticMarkup(createElement(DefectDetailsView, { details })) };
    }

    it("ST-024: Defect details show all work log entries newest first", async () => {
      await anExistingTeamMember(db, anna, "Anna");
      const defectId = await recorded(
        await reported(await registered("LG-042"), "Left flipper barely moves", "2026-10-04T10:00:00Z"),
        "2026-10-04T10:00:00Z",
      );
      // Monday, Tuesday and Wednesday.
      await logged(defectId, 0, tom, "2026-10-05T08:00:00Z", "Checked the coil", "");
      await logged(defectId, 1, anna, "2026-10-06T09:30:00Z", "Cleaned the flipper mechanism");
      await logged(
        defectId,
        2,
        tom,
        "2026-10-07T16:15:00Z",
        "Replaced coil stop and EOS switch",
        "1x coil stop, 1x EOS switch",
      );

      const { details, html } = await seenByAnna(defectId);

      expect(details?.workLog).toEqual([
        {
          id: expect.any(String),
          whatWasDone: "Replaced coil stop and EOS switch",
          partsUsed: "1x coil stop, 1x EOS switch",
          loggedBy: "Tom",
          loggedAt: new Date("2026-10-07T16:15:00Z"),
        },
        {
          id: expect.any(String),
          whatWasDone: "Cleaned the flipper mechanism",
          partsUsed: undefined,
          loggedBy: "Anna",
          loggedAt: new Date("2026-10-06T09:30:00Z"),
        },
        {
          id: expect.any(String),
          whatWasDone: "Checked the coil",
          partsUsed: undefined,
          loggedBy: "Tom",
          loggedAt: new Date("2026-10-05T08:00:00Z"),
        },
      ]);
      // The page shows all three, Wednesday's first, each with who and when – and the parts where there are any.
      expect(html).toContain("Arbeitsschritte");
      const positions = ["Tom · 07.10.2026, 18:15", "Anna · 06.10.2026, 11:30", "Tom · 05.10.2026, 10:00"].map((text) =>
        html.indexOf(text),
      );
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
      expect(html).toContain("Replaced coil stop and EOS switch");
      expect(html).toContain("Cleaned the flipper mechanism");
      expect(html).toContain("Checked the coil");
      expect(html.match(/Verwendete Teile: /g)).toHaveLength(1);
      expect(html).toContain("Verwendete Teile: 1x coil stop, 1x EOS switch");
    });

    it("says that nobody has logged work yet, and offers logging work on an open defect only", async () => {
      await anExistingTeamMember(db, anna, "Anna");
      const defectId = await recorded(
        await reported(await registered("LG-042"), "Left flipper barely moves", NOW),
        NOW,
      );

      const open = await seenByAnna(defectId, true);
      expect(open.details).toMatchObject({ offered: ["claim", "log-work", "resolve"], workLog: [] });
      expect(open.html).toContain("Noch kein Arbeitsschritt eingetragen.");
      expect(open.html).toContain(`href="/team/defects/${defectId}/arbeitsschritt"`);
      // The address alone (`?done=log-work`) confirms nothing.
      expect(open.html).not.toContain("Arbeitsschritt zu „");

      await logged(defectId, 0, anna, "2026-10-06T09:30:00Z", "Cleaned the flipper mechanism");
      const afterLogging = await seenByAnna(defectId, true);
      expect(afterLogging.html).toContain("Arbeitsschritt zu „Left flipper weak“ eingetragen.");
      expect(afterLogging.html).not.toContain("Noch kein Arbeitsschritt");
      // Only who logged last is told so: after Tom's entry the same address confirms nothing to Anna.
      await logged(defectId, 1, tom, "2026-10-07T09:30:00Z", "Replaced the coil stop");
      const afterToms = await seenByAnna(defectId, true);
      expect(afterToms.details?.confirmed).toBeUndefined();
      expect(afterToms.html).not.toContain("Arbeitsschritt zu „");

      const resolved = await executeCommand(
        resolveDefectCommand,
        { defectId, version: 2, closingNote: "Fixed" },
        { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
      );
      if (!resolved.ok) throw new Error(resolved.error);
      const closed = await seenByAnna(defectId);
      expect(closed.details?.offered).toEqual([]);
      expect(closed.html).not.toContain("/arbeitsschritt");
      // What was done stays on the page.
      expect(closed.html).toContain("Cleaned the flipper mechanism");
    });
  });

  describe("resolving it (ST-028)", () => {
    const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
    const asTom = { id: tom.teamMemberId, role: tom.role };
    const asAnna = { id: anna.teamMemberId, role: anna.role };

    /** The page as that team member sees it, just back from resolving (`?done=resolve`). */
    async function seenBy(defectId: string, viewer: typeof asTom | typeof asAnna) {
      const details = await loadDefectDetails(db, fixedClock(NOW), defectId, {
        storage: memoryStorage(),
        viewer,
        done: "resolve",
      });
      const html = renderToStaticMarkup(createElement(DefectDetailsView, { details }));
      return { details, html };
    }

    async function aDefect(suitableForHelpers: boolean) {
      await anExistingTeamMember(db, anna, "Anna");
      const problemReportId = await reported(await registered("LG-042"), "Left flipper barely moves", NOW);
      const outcome = await executeCommand(
        recordDefectCommand,
        {
          problemReportId,
          version: 0,
          title: "Left flipper weak",
          priority: undefined,
          suitableForHelpers,
          machineStatus: undefined,
          machineVersion: undefined,
        },
        { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
      );
      if (!outcome.ok) throw new Error(outcome.error);
      return outcome.result.defectId;
    }

    it("offers resolving an open defect only to someone who may resolve it", async () => {
      const defectId = await aDefect(false);

      const toms = await seenBy(defectId, asTom);
      // A technician is also offered assigning it (ST-026) and changing its priority (ST-027), and putting it on hold (ST-029).
      expect(toms.details).toMatchObject({
        offered: ["claim", "log-work", "put-on-hold", "resolve", "assign", "prioritize"],
        resolution: undefined,
      });
      expect(toms.html).toContain(`href="/team/defects/${defectId}/beheben"`);
      // The address alone (`?done=resolve`) makes the page say nothing.
      expect(toms.html).not.toContain("behoben");
      const annas = await seenBy(defectId, asAnna);
      expect(annas.details?.offered).toEqual(["log-work"]);
      expect(annas.html).not.toContain("/beheben");
    });

    it("shows how a resolved defect ended, tells who resolved it so, and offers resolving to nobody", async () => {
      const defectId = await aDefect(true);
      const resolved = await executeCommand(
        resolveDefectCommand,
        { defectId, version: 0, closingNote: "Coil stop replaced, flipper tested for 20 minutes" },
        { actor: anna, db, clock: fixedClock("2026-10-04T09:30:00Z"), newId: randomUUID },
      );
      if (!resolved.ok) throw new Error(resolved.error);

      const annas = await seenBy(defectId, asAnna);
      expect(annas.details).toMatchObject({
        offered: [],
        confirmed: { action: "resolve" },
        resolution: { closingNote: "Coil stop replaced, flipper tested for 20 minutes", resolvedBy: "Anna" },
      });
      expect(annas.html).toContain("Du hast „Left flipper weak“ behoben.");
      expect(annas.html).toContain("Behoben von Anna am 04.10.2026, 11:30");
      expect(annas.html).toContain("Abschlussnotiz");
      expect(annas.html).toContain("Coil stop replaced, flipper tested for 20 minutes");
      expect(annas.html).not.toContain("/beheben");
      expect(annas.html).not.toContain("offen seit");
      const toms = await seenBy(defectId, asTom);
      expect(toms.details).toMatchObject({ offered: [], confirmed: undefined });
      expect(toms.html).toContain("Behoben von Anna am 04.10.2026, 11:30");
      expect(toms.html).not.toContain("Du hast");
    });
  });

  describe("with the photo of its originating problem report (ST-016)", () => {
    async function aDefectFromAReportWithAPhoto() {
      const photo = `problem-reports/${randomUUID()}.jpg`;
      const machineId = await registered("LG-042");
      const problemReportId = await reported(machineId, "Left flipper weak", "2026-10-01T09:00:00Z", visitor, photo);
      const defectId = await recorded(problemReportId, "2026-10-01T10:00:00Z");
      await reported(machineId, "Flipper weak again", "2026-10-02T09:00:00Z").then((id) =>
        executeCommand(
          linkProblemReportToDefectCommand,
          { problemReportId: id, version: 0, defectId },
          { actor: tom, db, newId: randomUUID },
        ),
      );
      return { photo, defectId };
    }

    async function shownAt(now: string, defectId: string) {
      const details = await loadDefectDetails(db, fixedClock(now), defectId, { storage: memoryStorage() });
      return { details, html: renderToStaticMarkup(createElement(DefectDetailsView, { details })) };
    }

    it("ST-016: Photo is shown in the defect details", async () => {
      const { photo, defectId } = await aDefectFromAReportWithAPhoto();

      const { details, html } = await shownAt(NOW, defectId);

      const address = `memory://${photo}?valid-until=2026-10-04T10:05:00.000Z`;
      expect(details!.problemReports.map((report) => [report.originating, report.photo?.address])).toEqual([
        [true, address],
        [false, undefined],
      ]);
      expect(html).toContain(`<img src="${address}" alt="Foto zur Meldung"`);
    });

    it("ST-016: Photo is kept with its problem report", async () => {
      const { photo, defectId } = await aDefectFromAReportWithAPhoto();

      const { html } = await shownAt("2027-10-04T10:00:00Z", defectId);

      expect(html).toContain(
        `<img src="memory://${photo}?valid-until=2027-10-04T10:05:00.000Z" alt="Foto zur Meldung"`,
      );
    });
  });
});
