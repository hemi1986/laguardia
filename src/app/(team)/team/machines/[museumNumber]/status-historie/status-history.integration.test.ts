import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { retireMachine, statusChangedAt } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadStatusHistory } from "./status-history-data";
import { StatusHistoryView } from "./status-history";

/**
 * The whole status history of one machine on a page of its own (ST-093, G24): the page's data – Collection's status
 * history with Team's names –, grouped by the Berlin calendar year, rendered by its view. In a database of its own,
 * because a test can only arrange "LG-042" where no other test registers machines.
 */
const isolated = isolatedTestDatabase("status_history");
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
    { title: "Medieval Madness", manufacturer: "Williams", machineCategory: "pinball" },
    { actor: eva, db, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  medievalMadness = created.result.machineModelId;
});

afterAll(() => isolated.close());

beforeEach(() => withoutMachines(db));

/** A machine Eva registered as Playable at the instant. */
async function registered(museumNumber: string, at: string): Promise<string> {
  const outcome = await executeCommand(
    registerMachineCommand,
    {
      machineModelId: medievalMadness,
      museumNumber,
      serialNumber: undefined,
      location: "Hall 2",
      machineStatus: "playable",
    },
    { actor: eva, db, clock: fixedClock(at), newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.machineId;
}

async function page(museumNumber: string): Promise<string> {
  const data = await loadStatusHistory(db, museumNumber);
  return renderToStaticMarkup(createElement(StatusHistoryView, { data, museumNumber }));
}

/** The entries under the year's heading, up to the next year's. */
function year(html: string, heading: string): string {
  const start = html.indexOf(`>${heading}<`);
  if (start < 0) return "";
  const next = html.indexOf("<section", start);
  return html.slice(start, next < 0 ? undefined : next);
}

const entries = (html: string) => [...html.matchAll(/<li\b/g)].length;

describe("the status history page", () => {
  it("ST-093: The whole status history on its own page", async () => {
    const machineId = await registered("LG-042", "2025-03-01T09:00:00Z");
    await statusChangedAt(db, machineId, ["2025-06-01T09:00:00Z", "2025-09-01T09:00:00Z"], tom);
    await statusChangedAt(
      db,
      machineId,
      [
        "2026-01-10T09:00:00Z",
        "2026-02-10T09:00:00Z",
        "2026-03-10T09:00:00Z",
        "2026-04-10T09:00:00Z",
        "2026-05-10T09:00:00Z",
      ],
      tom,
    );

    const data = await loadStatusHistory(db, "LG-042");
    const html = await page("LG-042");

    expect(data?.title).toBe("Status-Historie · LG-042");
    const newer = year(html, "2026 · 5 Einträge");
    const older = year(html, "2025 · 3 Einträge");
    expect(entries(newer)).toBe(5);
    expect(entries(older)).toBe(3);
    expect(html.indexOf("2026 · 5 Einträge")).toBeLessThan(html.indexOf("2025 · 3 Einträge"));
    // Newest first within a year too: the latest of 2026, then down to the registration at the end of 2025.
    expect([...newer.matchAll(/Change (\d)/g)].map((match) => match[1])).toEqual(["5", "4", "3", "2", "1"]);
    expect([...older.matchAll(/Change (\d)/g)].map((match) => match[1])).toEqual(["2", "1"]);
    expect(older.indexOf("Erfasst als Spielbereit")).toBeGreaterThan(older.indexOf("Change 1"));
    expect(older).toContain("Eva · 01.03.2025, 10:00");
    expect(newer).toContain("Change 5 · Tom · 10.05.2026, 11:00");
    expect(html).toContain('href="/team/machines/LG-042"');
    expect(html).toContain(">Zurück zum Gerät<");
  });

  it("ST-093: The year of an entry is the year in Berlin", async () => {
    const machineId = await registered("LG-042", "2025-05-01T09:00:00Z");
    // 00:30 on 1 January 2026 in Berlin is 23:30 on 31 December 2025 in UTC.
    await statusChangedAt(db, machineId, ["2025-12-31T23:30:00Z"], tom);

    const html = await page("LG-042");

    expect(year(html, "2026 · 1 Eintrag")).toContain("Spielbereit → Außer Betrieb");
    expect(year(html, "2025 · 1 Eintrag")).toContain("Erfasst als Spielbereit");
    expect(html).not.toContain("2025 · 2 Einträge");
  });

  it("ST-093: A retired machine's status history stays reachable", async () => {
    const machineId = await registered("LG-013", "2026-01-05T09:00:00Z");
    await statusChangedAt(
      db,
      machineId,
      Array.from({ length: 6 }, (_, month) => `2026-0${month + 2}-01T09:00:00Z`),
      tom,
    );
    await retireMachine(db, machineId, "2026-09-01T09:00:00Z");

    const html = await page("LG-013");

    expect(entries(year(html, "2026 · 7 Einträge"))).toBe(7);
  });

  it("ST-093: The page of an unknown machine", async () => {
    await registered("LG-042", "2026-01-05T09:00:00Z");

    expect(await loadStatusHistory(db, "LG-999")).toBeUndefined();
    expect(await page("LG-999")).toContain("Kein Gerät mit der Museumsnummer LG-999.");
  });
});
