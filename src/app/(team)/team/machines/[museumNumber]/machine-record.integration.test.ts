import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  attachFileCommand,
  changeMachineStatusCommand,
  createMachineModelCommand,
  registerMachineCommand,
  type FileCategory,
} from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { retireMachineCommand } from "@/modules/repair";
import {
  claimDefectCommand,
  putDefectOnHoldCommand,
  recordDefectCommand,
  reportProblemCommand,
  resolveDefectCommand,
  resolveProblemOnTheSpotCommand,
  type Priority,
} from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { statusChangedAt } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import type { Viewer } from "../../claimant";
import { loadMachineRecord } from "./machine-record-data";
import { MachineRecordView } from "./machine-record";
import { RetireQuestion } from "./ausmustern/retire-machine-form";

/**
 * The machine record (RM-MachineRecord, ST-009): the page's data – the Collection module's record with the names of
 * the Team module's team members (ST-009: modules are composed by the page) – rendered by its view. In a database of
 * its own, because a test can only arrange "LG-042" where no other test registers machines.
 */
const isolated = isolatedTestDatabase("machine_record");
let db: NodePgDatabase;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
let medievalMadness: string;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, eva, "Eva");
  await anExistingTeamMember(db, tom, "Tom");
  const created = await executeCommand(
    createMachineModelCommand,
    {
      title: "Medieval Madness",
      manufacturer: "Williams",
      year: "1997",
      machineCategory: "pinball",
      technology: "dmd",
    },
    { actor: eva, db, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  medievalMadness = created.result.machineModelId;
});

afterAll(() => isolated.close());

beforeEach(() => withoutMachines(db));

async function registered(museumNumber: string, at: string) {
  const outcome = await executeCommand(
    registerMachineCommand,
    {
      machineModelId: medievalMadness,
      museumNumber,
      serialNumber: "MM-12345",
      location: "Hall 2, row 3",
      machineStatus: "playable",
    },
    { actor: eva, db, clock: fixedClock(at), newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.machineId;
}

/** A registered machine that was retired on 2026-03-01 by Tom. */
async function retiredMachine(museumNumber: string): Promise<string> {
  const machineId = await registered(museumNumber, "2026-01-15T09:00:00Z");
  const retired = await executeCommand(
    retireMachineCommand,
    { machineId, version: 0, reason: "Sold" },
    { actor: tom, db, clock: fixedClock("2026-03-01T11:00:00Z"), newId: randomUUID },
  );
  if (!retired.ok) throw new Error("not retired");
  return machineId;
}

const NOW = "2026-10-14T10:00:00Z";

/** A technician looks at the page unless the test says who. */
const technician: Viewer = { id: eva.teamMemberId, role: "technician" };

async function page(museumNumber: string, viewer: Viewer = technician): Promise<string> {
  const record = await loadMachineRecord(db, museumNumber, { clock: fixedClock(NOW), viewer });
  return renderToStaticMarkup(createElement(MachineRecordView, { record, museumNumber }));
}

/** The part of the page from the given section's heading to the next section's. */
function section(html: string, heading: string): string {
  const start = html.indexOf(`>${heading}<`);
  if (start < 0) return "";
  const next = html.indexOf("<section", start);
  return html.slice(start, next < 0 ? undefined : next);
}

/** A problem report a visitor sends for the machine – untriaged, at version 0. */
async function reported(machineId: string, description: string, at: string) {
  const outcome = await executeCommand(
    reportProblemCommand,
    { machineId, description },
    { actor: { kind: "visitor" }, db, clock: fixedClock(at), newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.problemReportId;
}

/** An open defect of the machine, recorded by Eva through triage – at version 0. */
async function anOpenDefect(machineId: string, title: string, priority: Priority, at = "2026-10-10T09:00:00Z") {
  const recorded = await executeCommand(
    recordDefectCommand,
    {
      problemReportId: await reported(machineId, `${title} – reported`, at),
      version: 0,
      title,
      priority,
      suitableForHelpers: false,
      machineStatus: undefined,
      machineVersion: undefined,
    },
    { actor: eva, db, clock: fixedClock(at), newId: randomUUID },
  );
  if (!recorded.ok) throw new Error(recorded.error);
  return recorded.result.defectId;
}

describe("the machine record", () => {
  it("ST-009: Machine status history is shown newest first", async () => {
    const machineId = await registered("LG-042", "2026-01-15T09:00:00Z");
    const changed = await executeCommand(
      changeMachineStatusCommand,
      { machineId, version: 0, machineStatus: "out-of-order", reason: "flipper coil burnt" },
      { actor: tom, db, clock: fixedClock("2026-01-20T13:30:00Z"), newId: randomUUID },
    );
    if (!changed.ok) throw new Error("not changed");

    const html = await page("LG-042");

    const change = html.indexOf("Spielbereit → Außer Betrieb");
    const registration = html.indexOf("Erfasst als Spielbereit");
    expect(change).toBeGreaterThan(-1);
    expect(registration).toBeGreaterThan(change);
    expect(html).toContain("flipper coil burnt · Tom · 20.01.2026, 14:30");
    expect(html).toContain("Eva · 15.01.2026, 10:00");
  });

  describe("only the latest five status changes, and a link to all of them (ST-093, G24)", () => {
    /** One change a day from 1 February 2026 on, at 10:00 UTC – the newest is change `count`. */
    const changed = (machineId: string, count: number) =>
      statusChangedAt(
        db,
        machineId,
        Array.from({ length: count }, (_, day) => `2026-02-${String(day + 1).padStart(2, "0")}T10:00:00Z`),
        tom,
      );
    const statusHistory = (html: string) => section(html, "Status-Historie");
    const entries = (html: string) => [...statusHistory(html).matchAll(/<li\b/g)].length;

    it("ST-093: The machine record shows the latest five status changes", async () => {
      const machineId = await registered("LG-042", "2026-01-15T09:00:00Z");
      await changed(machineId, 7);

      const history = statusHistory(await page("LG-042"));

      expect(entries(history)).toBe(5);
      const shown = [...history.matchAll(/Change (\d)/g)].map((match) => match[1]);
      expect(shown).toEqual(["7", "6", "5", "4", "3"]);
      expect(history).not.toContain("Erfasst als Spielbereit");
      expect(history).toContain('href="/team/machines/LG-042/status-historie"');
      expect(history).toMatch(/>Alle Statusänderungen \(8\)</);
      expect(history.indexOf("Alle Statusänderungen")).toBeGreaterThan(history.indexOf("Change 3"));
    });

    it("ST-093: A short status history needs no link", async () => {
      await registered("LG-050", "2026-01-15T09:00:00Z");

      const history = statusHistory(await page("LG-050"));

      expect(entries(history)).toBe(1);
      expect(history).toContain("Erfasst als Spielbereit");
      expect(history).not.toContain("Alle Statusänderungen");
    });

    it("ST-093: Five entries need no link, six do", async () => {
      await changed(await registered("LG-043", "2026-01-15T09:00:00Z"), 4);
      await changed(await registered("LG-044", "2026-01-15T09:00:00Z"), 5);

      const five = statusHistory(await page("LG-043"));
      const six = statusHistory(await page("LG-044"));

      expect(entries(five)).toBe(5);
      expect(five).toContain("Erfasst als Spielbereit");
      expect(five).not.toContain("Alle Statusänderungen");
      expect(entries(six)).toBe(5);
      expect(six).not.toContain("Erfasst als Spielbereit");
      expect(six).toMatch(/>Alle Statusänderungen \(6\)</);
    });
  });

  it('ST-039: The machine record of a retired machine shows "retired" in place of the status', async () => {
    const machineId = await registered("LG-013", "2026-01-15T09:00:00Z");
    const changed = await executeCommand(
      changeMachineStatusCommand,
      { machineId, version: 0, machineStatus: "out-of-order", reason: "Display dead" },
      { actor: tom, db, clock: fixedClock("2026-02-01T10:00:00Z"), newId: randomUUID },
    );
    if (!changed.ok) throw new Error("not changed");
    const retired = await executeCommand(
      retireMachineCommand,
      { machineId, version: 1, reason: "Sold to a collector" },
      { actor: tom, db, clock: fixedClock("2026-03-01T11:00:00Z"), newId: randomUUID },
    );
    if (!retired.ok) throw new Error(retired.error);

    const html = await page("LG-013");

    expect(html).toContain('<dt class="text-muted-foreground">Status</dt><dd>Ausgemustert</dd>');
    // Retirement is no entry of the status history – it still ends with the change to Out of order.
    const newest = html.indexOf("Spielbereit → Außer Betrieb");
    expect(newest).toBeGreaterThan(-1);
    expect(html.indexOf("Ausgemustert", html.indexOf(">Status-Historie<"))).toBe(-1);
  });

  it("ST-009: Unknown museum number", async () => {
    await registered("LG-042", "2026-01-15T09:00:00Z");

    expect(await loadMachineRecord(db, "LG-999", { viewer: technician })).toBeUndefined();
    expect(await page("LG-999")).toContain("Kein Gerät mit der Museumsnummer LG-999.");
  });

  it("ST-009: Retired machine keeps its record", async () => {
    await retiredMachine("LG-013");

    const html = await page("LG-013");

    expect(html).toContain("Ausgemustert am 01.03.2026, 12:00 von Tom – Sold");
    expect(html).toContain("MM-12345");
    expect(html).toContain("Hall 2, row 3");
    expect(html).toContain("Erfasst als Spielbereit");
  });

  it("shows the machine model's details next to the machine's own", async () => {
    await registered("LG-042", "2026-01-15T09:00:00Z");

    const html = await page("LG-042");

    for (const [term, value] of [
      ["Seriennummer", "MM-12345"],
      ["Modell", "Medieval Madness"],
      ["Hersteller", "Williams"],
      ["Baujahr", "1997"],
      ["Kategorie", "Flipper"],
      ["Technik", "DMD"],
      ["Standort", "Hall 2, row 3"],
      ["Status", "Spielbereit"],
    ]) {
      expect(html).toContain(`<dt class="text-muted-foreground">${term}</dt><dd>${value}</dd>`);
    }
  });

  it("offers „Standort ändern“ for an active machine and not for a retired one (ST-034, G11)", async () => {
    await registered("LG-042", "2026-01-15T09:00:00Z");
    await retiredMachine("LG-013");

    expect(await page("LG-042")).toContain('href="/team/machines/LG-042/standort"');
    expect(await page("LG-013")).not.toContain("/standort");
  });

  it("offers „Gerät ausmustern“ only to technicians, and not on a retired machine (ST-039, G11)", async () => {
    await registered("LG-042", "2026-01-15T09:00:00Z");
    await retiredMachine("LG-013");
    const helper: Viewer = { id: randomUUID(), role: "helper" };

    expect(await page("LG-042")).toContain('href="/team/machines/LG-042/ausmustern"');
    expect(await page("LG-042", helper)).not.toContain("/ausmustern");
    expect(await page("LG-013")).not.toContain("/ausmustern");
  });

  it("offers „Angaben korrigieren“ only to technicians, and not on a retired machine (ST-035, G11)", async () => {
    await registered("LG-042", "2026-01-15T09:00:00Z");
    await retiredMachine("LG-013");
    const helper: Viewer = { id: randomUUID(), role: "helper" };

    expect(await page("LG-042")).toContain('href="/team/machines/LG-042/angaben"');
    expect(await page("LG-042", helper)).not.toContain("/angaben");
    expect(await page("LG-013")).not.toContain("/angaben");
  });

  it("offers „Status ändern“ only where the viewer has a machine status to set (ST-012, G11)", async () => {
    await registered("LG-042", "2026-01-15T09:00:00Z");
    await retiredMachine("LG-013");

    const helper: Viewer = { id: randomUUID(), role: "helper" };

    // A helper may set only „Außer Betrieb“ – on a playable machine that is a status to set …
    expect(await page("LG-042", helper)).toContain('href="/team/machines/LG-042/status"');
    expect(await page("LG-042")).toContain('href="/team/machines/LG-042/status"');
    expect(await page("LG-013")).not.toContain("/status");
  });

  it("offers a helper no „Status ändern“ on a machine already out of order, a technician still (ST-012, G11)", async () => {
    const machineId = await registered("LG-042", "2026-01-15T09:00:00Z");
    const changed = await executeCommand(
      changeMachineStatusCommand,
      { machineId, version: 0, machineStatus: "out-of-order", reason: "flipper coil burnt" },
      { actor: tom, db, clock: fixedClock("2026-01-20T13:30:00Z"), newId: randomUUID },
    );
    if (!changed.ok) throw new Error("not changed");

    expect(await page("LG-042", { id: randomUUID(), role: "helper" })).not.toContain("/status");
    expect(await page("LG-042")).toContain('href="/team/machines/LG-042/status"');
  });

  it("offers „Problem melden“ for an active machine and not for a retired one (ST-015, G11)", async () => {
    await registered("LG-042", "2026-01-15T09:00:00Z");
    await retiredMachine("LG-013");

    expect(await page("LG-042")).toContain('href="/team/machines/LG-042/melden"');
    expect(await page("LG-013")).not.toContain("/melden");
  });

  describe("its open defects and its repair history (ST-033)", () => {
    it("ST-033: Machine record shows open defects", async () => {
      const lg042 = await registered("LG-042", "2026-01-15T09:00:00Z");
      const flipper = await anOpenDefect(lg042, "Left flipper weak", "high");
      const rubber = await anOpenDefect(lg042, "Rubber cracked", "low");
      const claimed = await executeCommand(
        claimDefectCommand,
        { defectId: flipper, version: 0 },
        { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
      );
      if (!claimed.ok) throw new Error(claimed.error);

      const openDefects = section(await page("LG-042"), "Offene Defekte");

      // The same facts and words as the open defects list – high priority first.
      const entryOf = (title: string) => openDefects.slice(openDefects.indexOf(title)).split("</article>")[0];
      expect(openDefects.indexOf("Left flipper weak")).toBeLessThan(openDefects.indexOf("Rubber cracked"));
      expect(entryOf("Left flipper weak")).toContain("Priorität: hoch");
      expect(entryOf("Left flipper weak")).toContain("Übernommen von Tom");
      expect(entryOf("Rubber cracked")).toContain("Priorität: niedrig");
      expect(entryOf("Rubber cracked")).not.toContain("bernommen");
      expect(openDefects).toMatch(new RegExp(`<a [^>]*href="/team/defects/${flipper}"[^>]*>Left flipper weak</a>`));
      expect(openDefects).toMatch(new RegExp(`<a [^>]*href="/team/defects/${rubber}"[^>]*>Rubber cracked</a>`));
    });

    it("ST-029: Machine record shows the on-hold reason of an open defect", async () => {
      const lg042 = await registered("LG-042", "2026-01-15T09:00:00Z");
      const rubber = await anOpenDefect(lg042, "Rubber cracked", "normal");
      const held = await executeCommand(
        putDefectOnHoldCommand,
        { defectId: rubber, version: 0, reason: "waiting-for-part" },
        { actor: eva, db, clock: fixedClock(NOW), newId: randomUUID },
      );
      if (!held.ok) throw new Error(held.error);

      const openDefects = section(await page("LG-042"), "Offene Defekte");

      expect(openDefects.slice(openDefects.indexOf("Rubber cracked")).split("</article>")[0]).toContain(
        "Pausiert – Wartet auf Ersatzteil",
      );
    });

    it("ST-033: A machine without open defects says so", async () => {
      const lg042 = await registered("LG-042", "2026-01-15T09:00:00Z");
      // A resolved defect is not open.
      const resolved = await executeCommand(
        resolveDefectCommand,
        { defectId: await anOpenDefect(lg042, "Coin door jammed", "normal"), version: 0, closingNote: "Lock replaced" },
        { actor: eva, db, clock: fixedClock(NOW), newId: randomUUID },
      );
      if (!resolved.ok) throw new Error(resolved.error);

      expect(section(await page("LG-042"), "Offene Defekte")).toContain("Keine offenen Defekte.");
    });

    it("ST-033: A machine with no repair history", async () => {
      await registered("LG-042", "2026-01-15T09:00:00Z");

      const repairs = section(await page("LG-042"), "Reparaturhistorie");

      expect(repairs).toContain("An diesem Gerät wurde noch nichts repariert.");
      expect(repairs).not.toContain("Ganze Reparaturhistorie");
    });

    it("leads to the whole repair history from its first entry, even when the record shows every entry (ST-033)", async () => {
      // Its page shows more of each entry than the record does – the work log, the photos.
      const machineId = await registered("LG-042", "2026-01-15T09:00:00Z");
      const resolved = await executeCommand(
        resolveDefectCommand,
        {
          defectId: await anOpenDefect(machineId, "Left flipper weak", "normal", "2026-10-01T08:00:00Z"),
          version: 0,
          closingNote: "Coil replaced",
        },
        { actor: eva, db, clock: fixedClock("2026-10-01T12:00:00Z"), newId: randomUUID },
      );
      if (!resolved.ok) throw new Error(resolved.error);

      const repairs = section(await page("LG-042"), "Reparaturhistorie");

      expect(repairs).toContain("Coil replaced");
      expect(repairs).toContain('href="/team/machines/LG-042/reparaturhistorie"');
      expect(repairs).toMatch(/>Ganze Reparaturhistorie \(1\)</);
    });

    it("shows the 3 most recent repairs, the most recently ended first, and leads to the whole repair history", async () => {
      const lg042 = await registered("LG-042", "2026-01-15T09:00:00Z");
      const days = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];
      for (const [index, day] of days.entries()) {
        const resolved = await executeCommand(
          resolveDefectCommand,
          {
            defectId: await anOpenDefect(lg042, `Defect ${index + 1}`, "normal", `${day}T08:00:00Z`),
            version: 0,
            closingNote: `Closing note ${index + 1}`,
          },
          { actor: eva, db, clock: fixedClock(`${day}T12:00:00Z`), newId: randomUUID },
        );
        if (!resolved.ok) throw new Error(resolved.error);
      }
      const ball = await reported(lg042, "Ball stuck", "2026-10-05T08:00:00Z");
      const freed = await executeCommand(
        resolveProblemOnTheSpotCommand,
        { problemReportId: ball, version: 0, note: "Ball freed" },
        { actor: tom, db, clock: fixedClock("2026-10-05T08:10:00Z"), newId: randomUUID },
      );
      if (!freed.ok) throw new Error(freed.error);
      // Open defects are part of the repair history, but shown in their own section.
      await anOpenDefect(lg042, "Left flipper weak", "high", "2026-10-06T08:00:00Z");

      const repairs = section(await page("LG-042"), "Reparaturhistorie");

      expect(repairs).toContain("Ball freed");
      expect(repairs).toContain("Tom · 05.10.2026, 10:10");
      expect(repairs.indexOf("Ball freed")).toBeLessThan(repairs.indexOf("Defect 4"));
      expect(repairs.indexOf("Defect 4")).toBeLessThan(repairs.indexOf("Defect 3"));
      expect(repairs).toContain("Closing note 3");
      expect(repairs).not.toContain("Defect 2");
      expect(repairs).not.toContain("Left flipper weak");
      expect(repairs).toMatch(
        /<a [^>]*href="\/team\/machines\/LG-042\/reparaturhistorie"[^>]*>Ganze Reparaturhistorie \(6\)<\/a>/,
      );
    });
  });

  describe("its files (ST-037)", () => {
    it("offers attaching a file on a retired machine too – its manuals stay useful (user, 2026-10-18)", async () => {
      await retiredMachine("LG-013");

      expect(section(await page("LG-013"), "Dateien")).toMatch(
        /<a [^>]*href="\/team\/machines\/LG-013\/datei-anhaengen"[^>]*>Datei anhängen<\/a>/,
      );
    });

    it("ST-037: No files yet says so", async () => {
      await registered("LG-050", "2026-10-01T09:00:00Z");

      const files = section(await page("LG-050"), "Dateien");

      expect(files).toContain("Noch keine Dateien zu diesem Gerät oder seinem Modell.");
      expect(files).toMatch(/<a [^>]*href="\/team\/machines\/LG-050\/datei-anhaengen"[^>]*>Datei anhängen<\/a>/);
    });

    it("lists the files by file category, those of the machine model marked, each opened through its own address", async () => {
      const machineId = await registered("LG-042", "2026-10-01T09:00:00Z");
      const manual = await attached(machineId, "machine-model", "MM Operations Manual", "manual");
      await attached(machineId, "machine", "LG-042 wiring notes", "other");

      const files = section(await page("LG-042"), "Dateien");

      expect(files.indexOf("Handbuch")).toBeLessThan(files.indexOf("Sonstiges"));
      expect(files).toMatch(
        new RegExp(`<a [^>]*href="/team/dateien/${manual}"[^>]*>MM Operations Manual</a><span[^>]*> · Modell</span>`),
      );
      expect(files).toContain("LG-042 wiring notes");
      expect(files).not.toContain("Noch keine Dateien");
    });

    it("offers removing each file to technicians only (ST-038, G11)", async () => {
      const machineId = await registered("LG-043", "2026-10-01T09:00:00Z");
      const manual = await attached(machineId, "machine-model", "MM Manual (wrong edition)", "manual");

      const files = section(await page("LG-043"), "Dateien");

      expect(files).toMatch(
        new RegExp(`<a [^>]*href="/team/machines/LG-043/datei-entfernen/${manual}"[^>]*>Entfernen</a>`),
      );
      expect(files).toContain('aria-label="„MM Manual (wrong edition)“ entfernen"');
      expect(section(await page("LG-043", { id: randomUUID(), role: "helper" }), "Dateien")).not.toContain(
        "datei-entfernen",
      );
    });
  });
});

/** A file attached through CMD-AttachFile – its content as the upload module hands it over (ST-085). */
async function attached(
  machineId: string,
  attachTo: "machine" | "machine-model",
  title: string,
  fileCategory: FileCategory,
) {
  const outcome = await executeCommand(
    attachFileCommand,
    {
      machineId,
      attachTo,
      title,
      fileCategory,
      content: { name: `files/${randomUUID()}`, size: 1000, contentType: "application/pdf" },
    },
    { actor: eva, db, clock: fixedClock(NOW), newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.fileId;
}

/** The class of the link or button with exactly that text – which component drew it. */
function classOf(html: string, text: string): string {
  const match = new RegExp(`<(?:a|button) [^>]*class="([^"]*)"[^>]*>${text}</(?:a|button)>`).exec(html);
  if (!match) throw new Error(`no link or button „${text}“`);
  return match[1];
}

describe("red only for what cannot be undone (ST-092, G30)", () => {
  it("ST-092: Only the verb of a question page is red", async () => {
    const machineId = await registered("LG-042", "2026-10-01T09:00:00Z");
    await attached(machineId, "machine", "Manual", "manual");

    const html = await page("LG-042");

    const secondaryButton = classOf(html, "Status ändern");
    expect(classOf(html, "Gerät ausmustern")).toBe(secondaryButton);
    expect(classOf(html, "Entfernen")).toBe(secondaryButton);
    // Red is the destructive button's own colour – every button names `destructive` for a field marked invalid.
    expect(html).not.toContain("bg-destructive");

    const question = renderToStaticMarkup(
      createElement(RetireQuestion, { museumNumber: "LG-042", openDefects: 0, problemReports: 0, pending: false }),
    );
    expect(classOf(question, "Endgültig ausmustern")).toContain("bg-destructive");
    expect(classOf(question, "Zurück")).not.toContain("bg-destructive");
    expect(question.match(/ bg-destructive\//g)).toHaveLength(1);
  });
});
