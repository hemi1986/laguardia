import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import type { Priority } from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { memoryStorage } from "@/platform/storage";
import { aDefectWithHistory } from "@/test-support/defects";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { loadDefectDetails } from "../defects/[defectId]/defect-details-data";
import { DefectDetailsView } from "../defects/[defectId]/defect-details";
import { RepairTimesView } from "./repair-times";
import { loadRepairTimes } from "./repair-times-data";

/**
 * The repair times' page (ST-051): RM-RepairTimes for the period the address names, in words. A rule over all defects,
 * so in a database of its own, emptied before each test.
 */
const isolated = isolatedTestDatabase("repair_times_page");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const NOW = new Date("2026-10-24T12:00:00Z");
const DAY = 86_400_000;
const clock = fixedClock(NOW.toISOString());

const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

const aDefect = (title: string, recordedAt: string, priority?: Priority) =>
  aDefectWithHistory(db, { by: tom, title, recordedAt, priority });

/** A defect reported `reported` days ago, with its first work log entry and its resolution that many days later. */
async function aRepair(priority: Priority, { toWork, toResolved }: { toWork?: number; toResolved: number }) {
  const reported = 20;
  const defect = await aDefect(`Repair ${randomUUID().slice(0, 8)}`, ago(reported), priority);
  if (toWork !== undefined) await defect.logWork(ago(reported - toWork));
  await defect.resolve(ago(reported - toResolved));
  return defect;
}

/** The page as a technician sees it, for the period the address names. */
async function page(zeitraum?: string) {
  const data = await loadRepairTimes(db, clock, { zeitraum });
  return { data, html: renderToStaticMarkup(createElement(RepairTimesView, data)) };
}

/** The text the page shows for one priority – its section, without the markup. */
async function sectionOf(priority: string, zeitraum?: string) {
  const { html } = await page(zeitraum);
  const section = html.match(new RegExp(`<section[^>]*aria-label="Priorität ${priority}"[^>]*>(.*?)</section>`))?.[1];
  if (section === undefined) throw new Error(`no section for ${priority}`);
  return section.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

beforeAll(async () => {
  db = await isolated.reset();
});

afterAll(() => isolated.close());

beforeEach(() => withoutMachines(db));

describe("the repair times' page", () => {
  it("ST-051: Median times per priority", async () => {
    await aRepair("high", { toWork: 1, toResolved: 3 });
    await aRepair("high", { toWork: 2, toResolved: 5 });
    await aRepair("high", { toWork: 6, toResolved: 10 });

    const high = await sectionOf("hoch");

    expect(high).toContain("Bis zum ersten Arbeitsschritt: 2,0 Tage · 3 Defekte");
    expect(high).toContain("Bis behoben: 5,0 Tage · 3 Defekte");
  });

  it("ST-051: Median of an even number of defects", async () => {
    await aRepair("normal", { toResolved: 2 });
    await aRepair("normal", { toResolved: 5 });

    expect(await sectionOf("normal")).toContain("Bis behoben: 3,5 Tage · 2 Defekte");
  });

  it("ST-051: Switch to 90 days", async () => {
    const displayFlickers = await aDefect("Display flickers", ago(70), "high");
    await displayFlickers.resolve(ago(60));

    expect(await sectionOf("hoch", "90")).toContain("Bis behoben: 10,0 Tage · 1 Defekt");
    expect(await sectionOf("hoch", "30")).toContain("Keine Defekte in diesem Zeitraum.");
  });

  it("ST-051: A reopened defect does not count for the time to resolved while it is open", async () => {
    const leftFlipperWeak = await aDefect("Left flipper weak", ago(12));
    await leftFlipperWeak.resolve(ago(10));
    await leftFlipperWeak.reopen(ago(5));

    expect(await sectionOf("normal")).toContain("Keine Defekte in diesem Zeitraum.");
    const details = await loadDefectDetails(db, clock, leftFlipperWeak.defectId, { storage: memoryStorage() });
    expect(renderToStaticMarkup(createElement(DefectDetailsView, { details }))).not.toContain("Bis behoben");
  });

  it("ST-051: A time without defects in the period says so", async () => {
    const coinDoorJammed = await aDefect("Coin door jammed", ago(3));
    await coinDoorJammed.logWork(ago(2));

    const normal = await sectionOf("normal");

    expect(normal).toContain("Bis zum ersten Arbeitsschritt: 1,0 Tage · 1 Defekt");
    expect(normal).toContain("Bis behoben: kein Defekt in diesem Zeitraum");
  });

  it("ST-051: A priority without defects in the period says so", async () => {
    await aRepair("high", { toWork: 1, toResolved: 3 });

    const low = await sectionOf("niedrig");

    expect(low).toContain("Keine Defekte in diesem Zeitraum.");
    expect(low).not.toContain("Bis zum ersten Arbeitsschritt");
    expect(low).not.toContain("Bis behoben");
  });

  it("ST-051: The view explains the times without the word median", async () => {
    await aRepair("high", { toWork: 1, toResolved: 3 });

    const { data, html } = await page();

    expect(data.period).toBe(30);
    expect(html).toContain(
      "Beide Zeiten zählen ab der frühesten Meldung eines Defekts – bis zu seinem ersten Arbeitsschritt und bis er behoben ist.",
    );
    expect(html).toContain("Typische Dauer: Die Hälfte der Defekte ging schneller, die Hälfte langsamer.");
    expect(html).not.toMatch(/median/i);
  });

  it("offers the two periods in this order, the chosen one marked, and reads an unknown period as the last 30 days", async () => {
    const { html } = await page("90");
    expect(html).toMatch(/Letzte 30 Tage.*Letzte 90 Tage/);
    const marked = html.match(/<a [^>]*aria-current="page"[^>]*>([^<]*)<\/a>/g);
    expect(marked).toHaveLength(1);
    expect(marked?.[0]).toContain('href="/team/repair-times?zeitraum=90"');
    expect((await page("365")).data.period).toBe(30);
  });
});
